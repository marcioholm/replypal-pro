-- 012 — Aba "Arquivos" na conversa + controle de acesso a RH, financeiro e certificado
-- Idempotente. Não apaga dados. Pré-requisito: 011.
--
-- Regra de negócio:
--   admin e supervisor veem e enviam tudo.
--   Os demais perfis (atendente, recepcionista) veem só as áreas "geral", "fiscal"
--   e "cartao_cnpj". Para "rh", "financeiro" e "certificado" precisam pedir acesso;
--   um admin/supervisor aprova, e o acesso vale por algumas horas, só para aquele
--   cliente e aquela área.
--
-- ATENÇÃO: enquanto o login não usar o Supabase Auth, o banco não sabe quem está
-- chamando. Estas regras organizam o fluxo e deixam rastro (acessos_log), mas a
-- proteção real só vem com Supabase Auth + RLS por usuário.

-- ─────────────────────────────────────────────────────────────
-- 1. Áreas de acesso
-- ─────────────────────────────────────────────────────────────
-- geral        pasta principal do cliente, contrato social etc.
-- fiscal       guias, notas, documentos fiscais
-- cartao_cnpj  cartão CNPJ
-- rh           folha de pagamento, admissões  (restrita)
-- financeiro   faturamento, compras, vendas, boletos/honorários  (restrita)
-- certificado  certificado digital  (restrita; nunca enviado pelo chat)

CREATE OR REPLACE FUNCTION public.area_restrita(p_area text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$ SELECT p_area IN ('rh', 'financeiro', 'certificado') $$;

-- ─────────────────────────────────────────────────────────────
-- 2. documentos (tabela já existe em produção, criada fora das migrations)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  categoria TEXT,
  tipo TEXT,
  mes INTEGER,
  ano INTEGER,
  url TEXT,
  nome_arquivo TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by TEXT
);
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Área calculada a partir de categoria/tipo (mantém compatível com o n8n atual)
CREATE OR REPLACE FUNCTION public.area_do_documento(p_categoria text, p_tipo text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tipo = 'certificado_digital' THEN 'certificado'
    WHEN p_tipo = 'cartao_cnpj' THEN 'cartao_cnpj'
    WHEN p_categoria = 'RH' OR p_tipo = 'folha_pagamento' THEN 'rh'
    WHEN p_categoria = 'Financeiro'
      OR p_tipo IN ('faturamento', 'compras', 'vendas', 'boletos_honorarios') THEN 'financeiro'
    WHEN p_categoria = 'Fiscal' OR p_tipo = 'documentos_fiscais' THEN 'fiscal'
    ELSE 'geral'
  END
$$;

CREATE INDEX IF NOT EXISTS idx_documentos_cliente_data ON public.documentos (cliente_id, uploaded_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. cliente_links: atalhos do cliente (pastas do Drive, cartão CNPJ, etc.)
--    Substitui as colunas soltas clientes.drive_folder_url / drive_payroll_url /
--    drive_billing_url (que continuam existindo por compatibilidade).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cliente_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('geral', 'fiscal', 'cartao_cnpj', 'rh', 'financeiro', 'certificado')),
  titulo TEXT NOT NULL,
  url TEXT NOT NULL CHECK (url ~* '^https?://'),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cliente_id, area, titulo)
);
CREATE INDEX IF NOT EXISTS idx_cliente_links_cliente ON public.cliente_links (cliente_id, area, ordem);

DROP TRIGGER IF EXISTS set_updated_at_cliente_links ON public.cliente_links;
CREATE TRIGGER set_updated_at_cliente_links
  BEFORE UPDATE ON public.cliente_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Copia os links antigos, se as colunas existirem
DO $$
DECLARE col record;
BEGIN
  FOR col IN
    SELECT * FROM (VALUES
      ('drive_folder_url',  'geral',      'Pasta do cliente'),
      ('drive_payroll_url', 'rh',         'Pasta da folha (RH)'),
      ('drive_billing_url', 'financeiro', 'Pasta do faturamento')
    ) AS t(coluna, area, titulo)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = col.coluna
    ) THEN
      EXECUTE format(
        'INSERT INTO public.cliente_links (tenant_id, cliente_id, area, titulo, url)
         SELECT c.tenant_id, c.id, %L, %L, trim(c.%I)
         FROM public.clientes c
         WHERE c.tenant_id IS NOT NULL AND trim(coalesce(c.%I, '''')) ~* ''^https?://''
         ON CONFLICT (cliente_id, area, titulo) DO NOTHING',
        col.area, col.titulo, col.coluna, col.coluna);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Solicitações de acesso
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS acesso_temporario_horas INTEGER NOT NULL DEFAULT 4;

CREATE TABLE IF NOT EXISTS public.solicitacoes_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('rh', 'financeiro', 'certificado')),
  solicitante_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  conversa_id UUID REFERENCES public.conversas(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL CHECK (length(trim(motivo)) >= 5),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'negada', 'cancelada')),
  decidido_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  resposta TEXT,
  expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (status <> 'aprovada' OR (decidido_por IS NOT NULL AND expira_em IS NOT NULL))
);

-- Só um pedido pendente por pessoa + cliente + área
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitacao_pendente
  ON public.solicitacoes_acesso (solicitante_id, cliente_id, area)
  WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_solicitacoes_tenant_status
  ON public.solicitacoes_acesso (tenant_id, status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. Registro de acessos (auditoria)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acessos_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN (
    'visualizou', 'enviou_no_chat', 'lancou_faturamento',
    'solicitou', 'aprovou', 'negou', 'cancelou', 'negado_sem_permissao'
  )),
  documento_id UUID REFERENCES public.documentos(id) ON DELETE SET NULL,
  link_id UUID REFERENCES public.cliente_links(id) ON DELETE SET NULL,
  solicitacao_id UUID REFERENCES public.solicitacoes_acesso(id) ON DELETE SET NULL,
  conversa_id UUID REFERENCES public.conversas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acessos_log_cliente ON public.acessos_log (cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acessos_log_tenant ON public.acessos_log (tenant_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 6. Regras em funções (o app chama estas, não monta a regra sozinho)
-- ─────────────────────────────────────────────────────────────

-- Pode ver/enviar esta área deste cliente agora?
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso(p_usuario UUID, p_cliente UUID, p_area TEXT)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT
    NOT public.area_restrita(p_area)
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = p_usuario AND u.role IN ('admin', 'supervisor')
    )
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_acesso s
      WHERE s.solicitante_id = p_usuario
        AND s.cliente_id = p_cliente
        AND s.area = p_area
        AND s.status = 'aprovada'
        AND s.expira_em > now()
    )
$$;

-- Pedir acesso (devolve o pedido pendente existente, se já houver)
CREATE OR REPLACE FUNCTION public.solicitar_acesso(
  p_usuario UUID, p_cliente UUID, p_area TEXT, p_motivo TEXT, p_conversa UUID DEFAULT NULL
)
RETURNS public.solicitacoes_acesso
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID;
  v_row public.solicitacoes_acesso;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.usuarios WHERE id = p_usuario;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Cliente de outro escritório';
  END IF;

  SELECT * INTO v_row FROM public.solicitacoes_acesso
  WHERE solicitante_id = p_usuario AND cliente_id = p_cliente AND area = p_area AND status = 'pendente';
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.solicitacoes_acesso (tenant_id, cliente_id, area, solicitante_id, conversa_id, motivo)
  VALUES (v_tenant, p_cliente, p_area, p_usuario, p_conversa, trim(p_motivo))
  RETURNING * INTO v_row;

  INSERT INTO public.acessos_log (tenant_id, usuario_id, cliente_id, area, acao, solicitacao_id, conversa_id)
  VALUES (v_tenant, p_usuario, p_cliente, p_area, 'solicitou', v_row.id, p_conversa);

  RETURN v_row;
END;
$$;

-- Aprovar ou negar (só admin/supervisor do mesmo escritório)
CREATE OR REPLACE FUNCTION public.decidir_solicitacao(
  p_solicitacao UUID, p_decisor UUID, p_aprovar BOOLEAN, p_resposta TEXT DEFAULT NULL
)
RETURNS public.solicitacoes_acesso
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.solicitacoes_acesso;
  v_role TEXT;
  v_tenant UUID;
  v_horas INTEGER;
BEGIN
  SELECT role, tenant_id INTO v_role, v_tenant FROM public.usuarios WHERE id = p_decisor;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Só admin ou supervisor pode decidir';
  END IF;

  SELECT * INTO v_row FROM public.solicitacoes_acesso WHERE id = p_solicitacao FOR UPDATE;
  IF NOT FOUND OR v_row.tenant_id <> v_tenant THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi %', v_row.status;
  END IF;

  SELECT coalesce(acesso_temporario_horas, 4) INTO v_horas
  FROM public.company_settings WHERE tenant_id = v_tenant;
  v_horas := coalesce(v_horas, 4);

  UPDATE public.solicitacoes_acesso SET
    status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'negada' END,
    decidido_por = p_decisor,
    decidido_em = now(),
    resposta = nullif(trim(coalesce(p_resposta, '')), ''),
    expira_em = CASE WHEN p_aprovar THEN now() + make_interval(hours => v_horas) END
  WHERE id = p_solicitacao
  RETURNING * INTO v_row;

  INSERT INTO public.acessos_log (tenant_id, usuario_id, cliente_id, area, acao, solicitacao_id, conversa_id)
  VALUES (v_tenant, p_decisor, v_row.cliente_id, v_row.area,
          CASE WHEN p_aprovar THEN 'aprovou' ELSE 'negou' END, v_row.id, v_row.conversa_id);

  RETURN v_row;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Views para a aba "Arquivos"
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_documentos_cliente AS
SELECT
  d.*,
  public.area_do_documento(d.categoria, d.tipo) AS area,
  public.area_restrita(public.area_do_documento(d.categoria, d.tipo)) AS restrito
FROM public.documentos d;

-- Faturamento do mês corrente por cliente (só o status; o valor exige acesso)
CREATE OR REPLACE VIEW public.vw_faturamento_status_mes AS
SELECT
  c.id AS cliente_id,
  c.tenant_id,
  EXTRACT(MONTH FROM now())::int AS mes,
  EXTRACT(YEAR FROM now())::int AS ano,
  (f.id IS NOT NULL) AS lancado,
  f.updated_at AS lancado_em
FROM public.clientes c
LEFT JOIN public.dados_financeiros f
  ON f.cliente_id = c.id
 AND f.mes = EXTRACT(MONTH FROM now())::int
 AND f.ano = EXTRACT(YEAR FROM now())::int;

-- ─────────────────────────────────────────────────────────────
-- 8. Realtime: supervisores recebem o pedido na hora
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'solicitacoes_acesso'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_acesso;
  END IF;
END $$;
