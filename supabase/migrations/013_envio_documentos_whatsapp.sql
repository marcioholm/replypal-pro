-- 013 — Cliente pede documento no WhatsApp e o sistema envia (automático, um clique ou com aprovação do admin)
-- Idempotente. Não apaga dados. Pré-requisitos: 011 e 012.
--
-- Níveis por tipo de documento (configuráveis por escritório):
--   automatico        o bot confirma com o cliente e envia sozinho
--   um_clique         o bot avisa o cliente e a atendente envia com um clique
--   aprovacao_admin   um admin precisa aprovar (e digitar o nome da empresa); o envio é
--                     um link que expira, nunca o arquivo
--   nunca             o bot passa a conversa para uma pessoa
--
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Só recebe documento quem está cadastrado como contato da empresa e marcado como
-- "pode receber documentos" (certificado tem uma marcação própria).

-- ─────────────────────────────────────────────────────────────
-- 1. contatos da empresa (tabela da migration 001, até hoje sem uso:
--    os contatos do cadastro do cliente não eram gravados no banco)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS pode_receber_documentos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS pode_receber_certificado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS whatsapp_digitos TEXT
  GENERATED ALWAYS AS (nullif(regexp_replace(coalesce(whatsapp, telefone, ''), '\D', '', 'g'), '')) STORED;

-- A CHECK antiga de "tipo" (Financeiro/RH/Fiscal/Societário/Outro) não cobre os papéis do app
ALTER TABLE public.contatos DROP CONSTRAINT IF EXISTS contatos_tipo_check;

UPDATE public.contatos ct SET tenant_id = c.tenant_id
FROM public.clientes c
WHERE ct.customer_id = c.id AND ct.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contatos_tenant_whatsapp ON public.contatos (tenant_id, whatsapp_digitos);
CREATE INDEX IF NOT EXISTS idx_contatos_cliente ON public.contatos (customer_id);

DROP TRIGGER IF EXISTS set_updated_at_contatos ON public.contatos;
CREATE TRIGGER set_updated_at_contatos
  BEFORE UPDATE ON public.contatos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Telefone brasileiro em partes: DDD (pode faltar) + últimos 8 dígitos.
-- Resolve +55, DDD com ou sem 0 e o 9 extra dos celulares.
CREATE OR REPLACE FUNCTION public.telefone_chave(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  WITH d AS (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS x),
       s AS (SELECT CASE
                      WHEN length(x) >= 12 AND left(x, 2) = '55' THEN substr(x, 3)
                      WHEN length(x) IN (11, 12) AND left(x, 1) = '0' THEN substr(x, 2)
                      ELSE x END AS y FROM d)
  SELECT CASE
           WHEN length(y) < 8 THEN NULL
           WHEN length(y) IN (10, 11) THEN left(y, 2) || '-' || right(y, 8)
           ELSE '??-' || right(y, 8)
         END
  FROM s
$$;

-- Mesmo telefone: últimos 8 dígitos iguais e, se os dois têm DDD, o mesmo DDD
CREATE OR REPLACE FUNCTION public.mesmo_telefone(a text, b text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ka IS NOT NULL AND kb IS NOT NULL
     AND right(ka, 8) = right(kb, 8)
     AND (left(ka, 2) = '??' OR left(kb, 2) = '??' OR left(ka, 2) = left(kb, 2))
  FROM (SELECT public.telefone_chave(a) AS ka, public.telefone_chave(b) AS kb) t
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. documentos: versão vigente
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS vigente BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_documentos_cliente_tipo_vigente
  ON public.documentos (cliente_id, tipo, uploaded_at DESC) WHERE vigente;

-- ─────────────────────────────────────────────────────────────
-- 3. Configuração por tipo de documento
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documento_tipos_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  rotulo TEXT NOT NULL,
  nivel TEXT NOT NULL CHECK (nivel IN ('automatico', 'um_clique', 'aprovacao_admin', 'nunca')),
  -- true: só competência deste mês ou do anterior (guias, folha, boletos); false: o mais recente vigente
  somente_mes_atual BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, tipo),
  -- certificado nunca pode ser automático nem um clique
  CHECK (tipo <> 'certificado_digital' OR nivel IN ('aprovacao_admin', 'nunca'))
);

INSERT INTO public.documento_tipos_config (tenant_id, tipo, rotulo, nivel, somente_mes_atual)
SELECT t.id, d.tipo, d.rotulo, d.nivel, d.mes_atual
FROM public.tenants t
CROSS JOIN (VALUES
  ('cartao_cnpj',        'Cartão CNPJ',                 'automatico',      false),
  ('alvara',             'Alvará de funcionamento',     'automatico',      false),
  ('documentos_fiscais', 'Guias e documentos fiscais',  'automatico',      true),
  ('boletos_honorarios', 'Boleto de honorários',        'automatico',      true),
  ('contrato_social',    'Contrato social',             'um_clique',       false),
  ('folha_pagamento',    'Folha de pagamento',          'um_clique',       true),
  ('faturamento',        'Relatório de faturamento',    'um_clique',       false),
  ('compras',            'Relatório de compras',        'um_clique',       false),
  ('vendas',             'Relatório de vendas',         'um_clique',       false),
  ('certificado_digital','Certificado digital',         'aprovacao_admin', false)
) AS d(tipo, rotulo, nivel, mes_atual)
ON CONFLICT (tenant_id, tipo) DO NOTHING;

-- Liga/desliga o atendimento automático de documentos por escritório (começa desligado)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS bot_documentos_ativo BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 4. Pedidos de documento vindos do WhatsApp
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedidos_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversa_id UUID REFERENCES public.conversas(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  documento_id UUID REFERENCES public.documentos(id) ON DELETE SET NULL,
  nivel TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_cliente' CHECK (status IN (
    'aguardando_cliente',    -- bot perguntou "quer o X da empresa Y? 1 = sim"
    'escolher_empresa',      -- contato tem mais de uma empresa
    'aguardando_envio',      -- um clique: esperando a atendente
    'aguardando_admin',      -- certificado: esperando aprovação
    'enviado',
    'recusado',              -- admin negou
    'nao_autorizado',        -- número não cadastrado ou sem permissão
    'sem_documento',         -- não há arquivo vigente
    'bloqueado',             -- nível "nunca"
    'cancelado'
  )),
  mensagem_cliente TEXT,
  motivo TEXT,
  enviado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,   -- null = automático
  enviado_em TIMESTAMPTZ,
  aprovado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_documento_fila
  ON public.pedidos_documento (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_documento_conversa ON public.pedidos_documento (conversa_id);

DROP TRIGGER IF EXISTS set_updated_at_pedidos_documento ON public.pedidos_documento;
CREATE TRIGGER set_updated_at_pedidos_documento
  BEFORE UPDATE ON public.pedidos_documento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link temporário de download (usado para o certificado: nunca o arquivo direto)
CREATE TABLE IF NOT EXISTS public.links_download (
  token TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(24), 'hex'),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos_documento(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  usado_em TIMESTAMPTZ,
  criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Novas ações no registro de auditoria
ALTER TABLE public.acessos_log DROP CONSTRAINT IF EXISTS acessos_log_acao_check;
ALTER TABLE public.acessos_log ADD CONSTRAINT acessos_log_acao_check CHECK (acao IN (
  'visualizou', 'enviou_no_chat', 'lancou_faturamento',
  'solicitou', 'aprovou', 'negou', 'cancelou', 'negado_sem_permissao',
  'pedido_pelo_cliente', 'enviado_automatico', 'enviado_um_clique',
  'aprovou_envio_certificado', 'negou_envio_certificado', 'baixou_link'
));
ALTER TABLE public.acessos_log ADD COLUMN IF NOT EXISTS pedido_documento_id UUID
  REFERENCES public.pedidos_documento(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. Decisão: o que fazer com o pedido (o n8n chama depois que a IA entende o pedido)
-- ─────────────────────────────────────────────────────────────
-- Devolve JSON com "decisao":
--   confirmar_com_cliente  -> pergunte "Quer o <rotulo> da <empresa>? 1 = sim" e, no "sim",
--                             chame confirmar_pedido_documento
--   escolher_empresa       -> mande a lista "empresas" numerada e chame de novo com p_cliente
--   nao_autorizado         -> "Não encontrei seu cadastro para receber documentos. Um atendente vai te ajudar."
--   sem_documento          -> "Esse documento não está no sistema. Um atendente vai te ajudar."
--   bloqueado              -> "Esse documento é tratado só com a equipe. Um atendente vai te ajudar."
CREATE OR REPLACE FUNCTION public.resolver_pedido_documento(
  p_tenant UUID,
  p_telefone TEXT,
  p_tipo TEXT,
  p_conversa UUID DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL,
  p_cliente UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cfg public.documento_tipos_config;
  v_contatos jsonb;
  v_qtd int;
  v_contato public.contatos;
  v_cliente public.clientes;
  v_doc public.documentos;
  v_pedido public.pedidos_documento;
  v_status text;
  v_decisao text;
BEGIN
  SELECT * INTO v_cfg FROM public.documento_tipos_config
  WHERE tenant_id = p_tenant AND tipo = p_tipo AND ativo;

  -- empresas em que este telefone é contato autorizado
  SELECT count(*), jsonb_agg(jsonb_build_object(
           'cliente_id', c.id, 'empresa', c.nome_fantasia, 'cnpj', c.cnpj, 'contato_id', ct.id)
         ORDER BY c.nome_fantasia)
    INTO v_qtd, v_contatos
  FROM public.contatos ct
  JOIN public.clientes c ON c.id = ct.customer_id
  WHERE ct.tenant_id = p_tenant
    AND public.mesmo_telefone(ct.whatsapp_digitos, p_telefone)
    AND ct.pode_receber_documentos
    AND (p_tipo <> 'certificado_digital' OR ct.pode_receber_certificado)
    AND (p_cliente IS NULL OR c.id = p_cliente)
    AND coalesce(c.status, 'Ativo') NOT IN ('Inativo', 'Encerrado');

  IF v_cfg.id IS NULL THEN
    v_status := 'bloqueado'; v_decisao := 'bloqueado';
  ELSIF v_cfg.nivel = 'nunca' THEN
    v_status := 'bloqueado'; v_decisao := 'bloqueado';
  ELSIF coalesce(v_qtd, 0) = 0 THEN
    v_status := 'nao_autorizado'; v_decisao := 'nao_autorizado';
  ELSIF v_qtd > 1 THEN
    v_status := 'escolher_empresa'; v_decisao := 'escolher_empresa';
  END IF;

  IF v_qtd = 1 AND v_decisao IS NULL THEN
    SELECT * INTO v_contato FROM public.contatos WHERE id = (v_contatos->0->>'contato_id')::uuid;
    SELECT * INTO v_cliente FROM public.clientes WHERE id = v_contato.customer_id;

    SELECT * INTO v_doc FROM public.documentos d
    WHERE d.cliente_id = v_cliente.id
      AND d.tipo = p_tipo
      AND d.vigente
      -- "mês atual" = competência deste mês ou do anterior (a guia paga em outubro
      -- é da competência de setembro); sem competência, vale o envio dos últimos 45 dias
      AND (NOT v_cfg.somente_mes_atual
           OR (d.ano * 12 + d.mes) >= (EXTRACT(YEAR FROM now())::int * 12 + EXTRACT(MONTH FROM now())::int - 1)
           OR (d.mes IS NULL AND d.uploaded_at >= now() - interval '45 days'))
    ORDER BY d.ano DESC NULLS LAST, d.mes DESC NULLS LAST, d.uploaded_at DESC
    LIMIT 1;

    IF v_doc.id IS NULL THEN
      v_status := 'sem_documento'; v_decisao := 'sem_documento';
    ELSE
      v_status := 'aguardando_cliente'; v_decisao := 'confirmar_com_cliente';
    END IF;
  END IF;

  INSERT INTO public.pedidos_documento
    (tenant_id, conversa_id, telefone, cliente_id, contato_id, tipo, documento_id, nivel, status, mensagem_cliente)
  VALUES
    (p_tenant, p_conversa, p_telefone, v_cliente.id, v_contato.id, p_tipo, v_doc.id, v_cfg.nivel, v_status, p_mensagem)
  RETURNING * INTO v_pedido;

  INSERT INTO public.acessos_log (tenant_id, cliente_id, area, acao, documento_id, conversa_id, pedido_documento_id)
  VALUES (p_tenant, v_cliente.id, public.area_do_documento(NULL, p_tipo), 'pedido_pelo_cliente',
          v_doc.id, p_conversa, v_pedido.id);

  RETURN jsonb_build_object(
    'decisao', v_decisao,
    'pedido_id', v_pedido.id,
    'nivel', v_cfg.nivel,
    'rotulo', coalesce(v_cfg.rotulo, p_tipo),
    'empresa', v_cliente.nome_fantasia,
    'empresas', CASE WHEN v_decisao = 'escolher_empresa' THEN v_contatos END,
    'documento', CASE WHEN v_doc.id IS NOT NULL THEN jsonb_build_object(
        'id', v_doc.id, 'nome_arquivo', v_doc.nome_arquivo, 'url', v_doc.url, 'mes', v_doc.mes, 'ano', v_doc.ano) END
  );
END;
$$;

-- Cliente respondeu "sim". Devolve o que fazer:
--   enviar_agora        (automatico)      -> n8n envia o arquivo e chama marcar_pedido_enviado(pedido, NULL)
--   avisar_equipe       (um_clique)       -> n8n responde "a equipe envia em instantes"; o pedido aparece na Caixa de Entrada
--   aguardar_aprovacao  (aprovacao_admin) -> n8n responde "precisa de aprovação, avisaremos"; admin aprova no sistema
CREATE OR REPLACE FUNCTION public.confirmar_pedido_documento(p_pedido UUID)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido public.pedidos_documento;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_documento WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND OR v_pedido.status <> 'aguardando_cliente' THEN
    RAISE EXCEPTION 'Pedido não está aguardando confirmação';
  END IF;

  UPDATE public.pedidos_documento SET status = CASE nivel
      WHEN 'automatico' THEN 'aguardando_cliente'   -- continua até o n8n marcar enviado
      WHEN 'um_clique' THEN 'aguardando_envio'
      WHEN 'aprovacao_admin' THEN 'aguardando_admin'
      ELSE 'bloqueado' END
  WHERE id = p_pedido
  RETURNING * INTO v_pedido;

  RETURN jsonb_build_object(
    'acao', CASE v_pedido.nivel
      WHEN 'automatico' THEN 'enviar_agora'
      WHEN 'um_clique' THEN 'avisar_equipe'
      WHEN 'aprovacao_admin' THEN 'aguardar_aprovacao'
      ELSE 'bloqueado' END,
    'pedido_id', v_pedido.id
  );
END;
$$;

-- Marca como enviado (p_usuario NULL = envio automático pelo n8n)
CREATE OR REPLACE FUNCTION public.marcar_pedido_enviado(p_pedido UUID, p_usuario UUID)
RETURNS public.pedidos_documento
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido public.pedidos_documento;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_documento WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF v_pedido.status NOT IN ('aguardando_cliente', 'aguardando_envio', 'aguardando_admin') THEN
    RAISE EXCEPTION 'Pedido já está %', v_pedido.status;
  END IF;
  IF v_pedido.nivel = 'aprovacao_admin' AND v_pedido.aprovado_por IS NULL THEN
    RAISE EXCEPTION 'Certificado precisa de aprovação do admin';
  END IF;
  IF p_usuario IS NULL AND v_pedido.nivel <> 'automatico' THEN
    RAISE EXCEPTION 'Só documentos automáticos podem ser enviados sem uma pessoa';
  END IF;
  IF p_usuario IS NOT NULL AND v_pedido.nivel <> 'aprovacao_admin'
     AND NOT public.usuario_tem_acesso(p_usuario, v_pedido.cliente_id, public.area_do_documento(NULL, v_pedido.tipo)) THEN
    RAISE EXCEPTION 'Sem acesso a esta área: peça acesso primeiro';
  END IF;

  UPDATE public.pedidos_documento
  SET status = 'enviado', enviado_por = p_usuario, enviado_em = now()
  WHERE id = p_pedido
  RETURNING * INTO v_pedido;

  INSERT INTO public.acessos_log (tenant_id, usuario_id, cliente_id, area, acao, documento_id, conversa_id, pedido_documento_id)
  VALUES (v_pedido.tenant_id, p_usuario, v_pedido.cliente_id, public.area_do_documento(NULL, v_pedido.tipo),
          CASE WHEN p_usuario IS NULL THEN 'enviado_automatico' ELSE 'enviado_um_clique' END,
          v_pedido.documento_id, v_pedido.conversa_id, v_pedido.id);

  RETURN v_pedido;
END;
$$;

-- Admin aprova ou nega o envio do certificado. Para aprovar, precisa digitar o nome
-- da empresa (o "tem certeza?" de verdade). Aprovado: gera um link de 24 h, uso único.
CREATE OR REPLACE FUNCTION public.decidir_envio_certificado(
  p_pedido UUID, p_admin UUID, p_aprovar BOOLEAN, p_confirmacao_empresa TEXT DEFAULT NULL, p_motivo TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido public.pedidos_documento;
  v_role text;
  v_tenant uuid;
  v_empresa text;
  v_token text;
BEGIN
  SELECT role, tenant_id INTO v_role, v_tenant FROM public.usuarios WHERE id = p_admin;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Só admin pode decidir o envio de certificado';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos_documento WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND OR v_pedido.tenant_id <> v_tenant OR v_pedido.status <> 'aguardando_admin' THEN
    RAISE EXCEPTION 'Pedido não está aguardando aprovação';
  END IF;

  IF NOT p_aprovar THEN
    UPDATE public.pedidos_documento
    SET status = 'recusado', aprovado_por = p_admin, aprovado_em = now(), motivo = p_motivo
    WHERE id = p_pedido;
    INSERT INTO public.acessos_log (tenant_id, usuario_id, cliente_id, area, acao, documento_id, conversa_id, pedido_documento_id)
    VALUES (v_tenant, p_admin, v_pedido.cliente_id, 'certificado', 'negou_envio_certificado',
            v_pedido.documento_id, v_pedido.conversa_id, v_pedido.id);
    RETURN jsonb_build_object('acao', 'recusado');
  END IF;

  SELECT nome_fantasia INTO v_empresa FROM public.clientes WHERE id = v_pedido.cliente_id;
  IF lower(trim(coalesce(p_confirmacao_empresa, ''))) <> lower(trim(coalesce(v_empresa, ''))) THEN
    RAISE EXCEPTION 'Digite o nome da empresa exatamente como no cadastro para confirmar';
  END IF;

  UPDATE public.pedidos_documento
  SET aprovado_por = p_admin, aprovado_em = now()
  WHERE id = p_pedido;

  INSERT INTO public.links_download (tenant_id, documento_id, pedido_id, criado_por)
  VALUES (v_tenant, v_pedido.documento_id, v_pedido.id, p_admin)
  RETURNING token INTO v_token;

  INSERT INTO public.acessos_log (tenant_id, usuario_id, cliente_id, area, acao, documento_id, conversa_id, pedido_documento_id)
  VALUES (v_tenant, p_admin, v_pedido.cliente_id, 'certificado', 'aprovou_envio_certificado',
          v_pedido.documento_id, v_pedido.conversa_id, v_pedido.id);

  -- o app manda o link na conversa e depois chama marcar_pedido_enviado(pedido, admin)
  RETURN jsonb_build_object('acao', 'enviar_link', 'token', v_token, 'expira_em', now() + interval '24 hours');
END;
$$;

-- Usa o link uma única vez (chamado pela rota /api/baixar/:token com a chave de serviço)
CREATE OR REPLACE FUNCTION public.usar_link_download(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_link public.links_download;
  v_doc public.documentos;
BEGIN
  SELECT * INTO v_link FROM public.links_download WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_link.usado_em IS NOT NULL OR v_link.expira_em < now() THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  UPDATE public.links_download SET usado_em = now() WHERE token = p_token;
  SELECT * INTO v_doc FROM public.documentos WHERE id = v_link.documento_id;
  INSERT INTO public.acessos_log (tenant_id, cliente_id, area, acao, documento_id, pedido_documento_id)
  VALUES (v_link.tenant_id, v_doc.cliente_id, public.area_do_documento(v_doc.categoria, v_doc.tipo),
          'baixou_link', v_doc.id, v_link.pedido_id);
  RETURN jsonb_build_object('ok', true, 'url', v_doc.url, 'nome_arquivo', v_doc.nome_arquivo);
END;
$$;

-- Fila para a Caixa de Entrada (um clique e aprovações)
CREATE OR REPLACE VIEW public.vw_pedidos_documento_pendentes AS
SELECT
  p.*,
  c.nome_fantasia AS empresa,
  ct.nome AS contato_nome,
  ct.role AS contato_papel,
  cfg.rotulo,
  d.nome_arquivo,
  d.url AS documento_url
FROM public.pedidos_documento p
LEFT JOIN public.clientes c ON c.id = p.cliente_id
LEFT JOIN public.contatos ct ON ct.id = p.contato_id
LEFT JOIN public.documento_tipos_config cfg ON cfg.tenant_id = p.tenant_id AND cfg.tipo = p.tipo
LEFT JOIN public.documentos d ON d.id = p.documento_id
WHERE p.status IN ('aguardando_envio', 'aguardando_admin');

-- Realtime para a fila
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedidos_documento'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_documento;
  END IF;
END $$;
