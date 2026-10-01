-- 014 — Dois funis: Pré-venda e Atendimento, com Triagem na entrada
-- Idempotente. Não apaga dados. Pré-requisitos: 011, 012 e 013.
--
--   triagem      conversa de número sem cliente vinculado; alguém decide em 1 clique:
--                vincular a um cliente (-> atendimento), é lead (-> pre_venda) ou arquivar
--   pre_venda    possível cliente; trabalhado só por admin e supervisor
--   atendimento  cliente vinculado; segue os status de sempre
--                (novo, aguardando atendimento, em atendimento, aguardando cliente, resolvido)
--   arquivado    não é cliente nem lead (fornecedor, pessoal, spam...)
--
-- A classificação é feita no banco (gatilho), então o webhook não precisa mudar:
-- toda conversa nova já nasce no funil certo.

-- ─────────────────────────────────────────────────────────────
-- 1. Funil na conversa
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;  -- já existe em produção
ALTER TABLE public.historico ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);  -- idem (009)
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS funil TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS arquivo_motivo TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS funil_atualizado_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS funil_atualizado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_funil_check;
ALTER TABLE public.conversas ADD CONSTRAINT conversas_funil_check
  CHECK (funil IN ('triagem', 'pre_venda', 'atendimento', 'arquivado')) NOT VALID;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_arquivo_motivo_check;
ALTER TABLE public.conversas ADD CONSTRAINT conversas_arquivo_motivo_check
  CHECK (arquivo_motivo IS NULL OR arquivo_motivo IN (
    'funcionario_de_cliente', 'fornecedor', 'parceiro', 'pessoal', 'spam', 'antigo', 'lead_perdido', 'outro'
  )) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_conversas_tenant_funil ON public.conversas (tenant_id, funil, last_message_time DESC);

-- Acha o cliente pelo telefone: WhatsApp do cadastro do cliente ou contato autorizado/cadastrado.
-- Só devolve se houver exatamente UM cliente; com mais de um, a triagem decide.
CREATE OR REPLACE FUNCTION public.cliente_pelo_telefone(p_tenant UUID, p_telefone TEXT)
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  WITH achados AS (
    SELECT c.id FROM public.clientes c
    WHERE c.tenant_id = p_tenant AND public.mesmo_telefone(c.whatsapp, p_telefone)
    UNION
    SELECT ct.customer_id FROM public.contatos ct
    WHERE ct.tenant_id = p_tenant AND public.mesmo_telefone(ct.whatsapp_digitos, p_telefone)
  )
  SELECT CASE WHEN count(*) = 1 THEN min(id::text)::uuid END FROM achados
$$;

-- Gatilho: decide o funil sempre que a conversa nasce ou muda de cliente
CREATE OR REPLACE FUNCTION public.classificar_funil_conversa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- tenta vincular sozinho pelo telefone
  IF NEW.customer_id IS NULL AND NOT coalesce(NEW.is_group, false) THEN
    NEW.customer_id := public.cliente_pelo_telefone(NEW.tenant_id, NEW.client_phone);
  END IF;

  IF NEW.customer_id IS NOT NULL OR coalesce(NEW.is_group, false) THEN
    -- ganhou cliente: vai (ou volta) para atendimento, a menos que alguém tenha arquivado de propósito
    IF NEW.funil IS DISTINCT FROM 'arquivado' OR TG_OP = 'INSERT' THEN
      NEW.funil := 'atendimento';
    END IF;
  ELSIF NEW.funil IS NULL THEN
    NEW.funil := 'triagem';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.funil IS DISTINCT FROM OLD.funil THEN
    NEW.funil_atualizado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classificar_funil_conversa ON public.conversas;
CREATE TRIGGER trg_classificar_funil_conversa
  BEFORE INSERT OR UPDATE OF customer_id, is_group, funil ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.classificar_funil_conversa();

-- ─────────────────────────────────────────────────────────────
-- 2. Oportunidades (pré-venda)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversa_id UUID REFERENCES public.conversas(id) ON DELETE SET NULL,
  nome_contato TEXT NOT NULL,
  telefone TEXT,
  empresa_nome TEXT,
  cnpj TEXT,
  regime_pretendido TEXT CHECK (regime_pretendido IS NULL OR regime_pretendido IN
    ('MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Pessoa física', 'Abertura de empresa')),
  servicos TEXT[] NOT NULL DEFAULT '{}',
  colaboradores TEXT,
  valor_mensal_estimado NUMERIC(10, 2),
  origem TEXT NOT NULL DEFAULT 'whatsapp' CHECK (origem IN
    ('whatsapp', 'indicacao', 'site', 'instagram', 'empreenda_hub', 'evento', 'outro')),
  etapa TEXT NOT NULL DEFAULT 'novo_lead' CHECK (etapa IN
    ('novo_lead', 'qualificacao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido')),
  responsavel_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  proximo_passo TEXT,
  proximo_contato_em DATE,
  motivo_perda TEXT CHECK (motivo_perda IS NULL OR motivo_perda IN
    ('preco', 'ficou_com_atual', 'sem_resposta', 'nao_era_o_momento', 'servico_nao_atendido', 'outro')),
  observacoes TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ganho_em TIMESTAMPTZ,
  perdido_em TIMESTAMPTZ,
  created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (etapa <> 'ganho' OR cliente_id IS NOT NULL),
  CHECK (etapa <> 'perdido' OR motivo_perda IS NOT NULL)
);

-- Uma oportunidade aberta por conversa
CREATE UNIQUE INDEX IF NOT EXISTS uq_oportunidade_aberta_por_conversa
  ON public.oportunidades (conversa_id)
  WHERE etapa NOT IN ('ganho', 'perdido') AND conversa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oportunidades_funil ON public.oportunidades (tenant_id, etapa, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_oportunidades_proximo_contato
  ON public.oportunidades (tenant_id, proximo_contato_em) WHERE etapa NOT IN ('ganho', 'perdido');

DROP TRIGGER IF EXISTS set_updated_at_oportunidades ON public.oportunidades;
CREATE TRIGGER set_updated_at_oportunidades
  BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Histórico de etapas: base para conversão e tempo em cada etapa
CREATE TABLE IF NOT EXISTS public.oportunidade_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  oportunidade_id UUID NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  de_etapa TEXT,
  para_etapa TEXT NOT NULL,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oportunidade_eventos_op ON public.oportunidade_eventos (oportunidade_id, created_at);

-- BEFORE: carimba as datas de ganho/perda
CREATE OR REPLACE FUNCTION public.datas_etapa_oportunidade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.etapa = 'ganho' THEN NEW.ganho_em := coalesce(NEW.ganho_em, now()); END IF;
  IF NEW.etapa = 'perdido' THEN NEW.perdido_em := coalesce(NEW.perdido_em, now()); END IF;
  RETURN NEW;
END;
$$;

-- AFTER: grava a mudança de etapa no histórico
CREATE OR REPLACE FUNCTION public.registrar_evento_oportunidade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.oportunidade_eventos (tenant_id, oportunidade_id, de_etapa, para_etapa, usuario_id)
    VALUES (NEW.tenant_id, NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.etapa END, NEW.etapa,
            coalesce(NEW.responsavel_id, NEW.created_by));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_datas_etapa_oportunidade ON public.oportunidades;
CREATE TRIGGER trg_datas_etapa_oportunidade
  BEFORE INSERT OR UPDATE OF etapa ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.datas_etapa_oportunidade();

DROP TRIGGER IF EXISTS trg_evento_oportunidade ON public.oportunidades;
CREATE TRIGGER trg_evento_oportunidade
  AFTER INSERT OR UPDATE OF etapa ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_oportunidade();

-- ─────────────────────────────────────────────────────────────
-- 3. Ações (o app chama estas funções)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.exigir_papel(p_usuario UUID, p_papeis TEXT[])
RETURNS UUID   -- devolve o tenant do usuário
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_tenant UUID; v_role TEXT;
BEGIN
  SELECT tenant_id, role INTO v_tenant, v_role FROM public.usuarios WHERE id = p_usuario;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF p_papeis IS NOT NULL AND NOT (v_role = ANY (p_papeis)) THEN
    RAISE EXCEPTION 'Ação permitida só para: %', array_to_string(p_papeis, ', ');
  END IF;
  RETURN v_tenant;
END;
$$;

-- Triagem/pré-venda -> atendimento: liga a conversa a um cliente e guarda o telefone
-- como contato da empresa (da próxima vez o vínculo é automático)
CREATE OR REPLACE FUNCTION public.vincular_conversa_cliente(
  p_conversa UUID, p_cliente UUID, p_usuario UUID,
  p_nome_contato TEXT DEFAULT NULL, p_papel TEXT DEFAULT NULL
)
RETURNS public.conversas
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID := public.exigir_papel(p_usuario, NULL);
  v_conv public.conversas;
BEGIN
  SELECT * INTO v_conv FROM public.conversas WHERE id = p_conversa FOR UPDATE;
  IF NOT FOUND OR v_conv.tenant_id <> v_tenant THEN RAISE EXCEPTION 'Conversa não encontrada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contatos
    WHERE customer_id = p_cliente AND public.mesmo_telefone(whatsapp_digitos, v_conv.client_phone)
  ) THEN
    INSERT INTO public.contatos (customer_id, tenant_id, nome, role, whatsapp)
    VALUES (p_cliente, v_tenant, coalesce(nullif(trim(p_nome_contato), ''), v_conv.client_name),
            nullif(trim(coalesce(p_papel, '')), ''), v_conv.client_phone);
  END IF;

  UPDATE public.conversas
  SET customer_id = p_cliente, funil = 'atendimento', arquivo_motivo = NULL, funil_atualizado_por = p_usuario
  WHERE id = p_conversa
  RETURNING * INTO v_conv;

  INSERT INTO public.historico (conversation_id, customer_id, action, user_id, tenant_id)
  VALUES (p_conversa, p_cliente, 'Vinculada a cliente e movida para Atendimento', p_usuario, v_tenant);
  RETURN v_conv;
END;
$$;

-- Triagem -> pré-venda (qualquer pessoa pode encaminhar; só admin/supervisor trabalham depois)
CREATE OR REPLACE FUNCTION public.enviar_para_pre_venda(
  p_conversa UUID, p_usuario UUID, p_empresa TEXT DEFAULT NULL,
  p_origem TEXT DEFAULT 'whatsapp', p_observacao TEXT DEFAULT NULL
)
RETURNS public.oportunidades
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID := public.exigir_papel(p_usuario, NULL);
  v_conv public.conversas;
  v_op public.oportunidades;
BEGIN
  SELECT * INTO v_conv FROM public.conversas WHERE id = p_conversa FOR UPDATE;
  IF NOT FOUND OR v_conv.tenant_id <> v_tenant THEN RAISE EXCEPTION 'Conversa não encontrada'; END IF;
  IF v_conv.customer_id IS NOT NULL THEN RAISE EXCEPTION 'Conversa já é de um cliente'; END IF;

  SELECT * INTO v_op FROM public.oportunidades
  WHERE conversa_id = p_conversa AND etapa NOT IN ('ganho', 'perdido');
  IF NOT FOUND THEN
    INSERT INTO public.oportunidades (tenant_id, conversa_id, nome_contato, telefone, empresa_nome, origem, observacoes, created_by)
    VALUES (v_tenant, p_conversa, v_conv.client_name, v_conv.client_phone,
            nullif(trim(coalesce(p_empresa, '')), ''), coalesce(p_origem, 'whatsapp'), p_observacao, p_usuario)
    RETURNING * INTO v_op;
  END IF;

  UPDATE public.conversas
  SET funil = 'pre_venda', arquivo_motivo = NULL, funil_atualizado_por = p_usuario
  WHERE id = p_conversa;

  INSERT INTO public.historico (conversation_id, action, user_id, tenant_id)
  VALUES (p_conversa, 'Encaminhada para Pré-venda', p_usuario, v_tenant);
  RETURN v_op;
END;
$$;

-- Arquivar (não é cliente nem lead)
CREATE OR REPLACE FUNCTION public.arquivar_conversa(p_conversa UUID, p_usuario UUID, p_motivo TEXT)
RETURNS public.conversas
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID := public.exigir_papel(p_usuario, NULL);
  v_conv public.conversas;
BEGIN
  UPDATE public.conversas
  SET funil = 'arquivado', arquivo_motivo = p_motivo, funil_atualizado_por = p_usuario
  WHERE id = p_conversa AND tenant_id = v_tenant AND customer_id IS NULL
  RETURNING * INTO v_conv;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada ou já vinculada a cliente'; END IF;

  INSERT INTO public.historico (conversation_id, action, details, user_id, tenant_id)
  VALUES (p_conversa, 'Conversa arquivada', p_motivo, p_usuario, v_tenant);
  RETURN v_conv;
END;
$$;

-- Reabrir uma arquivada (volta para a triagem)
CREATE OR REPLACE FUNCTION public.reabrir_conversa(p_conversa UUID, p_usuario UUID)
RETURNS public.conversas
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID := public.exigir_papel(p_usuario, ARRAY['admin', 'supervisor']);
  v_conv public.conversas;
BEGIN
  UPDATE public.conversas
  SET funil = 'triagem', arquivo_motivo = NULL, funil_atualizado_por = p_usuario
  WHERE id = p_conversa AND tenant_id = v_tenant AND funil = 'arquivado'
  RETURNING * INTO v_conv;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não está arquivada'; END IF;
  RETURN v_conv;
END;
$$;

-- Mudar etapa da oportunidade (só admin/supervisor).
-- ganho: exige p_cliente (cliente já cadastrado) e leva a conversa para Atendimento.
-- perdido: exige p_motivo_perda e arquiva a conversa como 'lead_perdido'.
CREATE OR REPLACE FUNCTION public.mover_oportunidade(
  p_oportunidade UUID, p_usuario UUID, p_etapa TEXT,
  p_cliente UUID DEFAULT NULL, p_motivo_perda TEXT DEFAULT NULL
)
RETURNS public.oportunidades
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID := public.exigir_papel(p_usuario, ARRAY['admin', 'supervisor']);
  v_op public.oportunidades;
BEGIN
  SELECT * INTO v_op FROM public.oportunidades WHERE id = p_oportunidade FOR UPDATE;
  IF NOT FOUND OR v_op.tenant_id <> v_tenant THEN RAISE EXCEPTION 'Oportunidade não encontrada'; END IF;
  IF v_op.etapa IN ('ganho', 'perdido') THEN RAISE EXCEPTION 'Oportunidade já encerrada (%)', v_op.etapa; END IF;

  IF p_etapa = 'ganho' THEN
    IF p_cliente IS NULL THEN RAISE EXCEPTION 'Para marcar como ganho, cadastre ou escolha o cliente'; END IF;
    UPDATE public.oportunidades
    SET etapa = 'ganho', cliente_id = p_cliente, responsavel_id = coalesce(responsavel_id, p_usuario)
    WHERE id = p_oportunidade RETURNING * INTO v_op;
    IF v_op.conversa_id IS NOT NULL THEN
      PERFORM public.vincular_conversa_cliente(v_op.conversa_id, p_cliente, p_usuario, v_op.nome_contato, 'Responsável');
    END IF;
  ELSIF p_etapa = 'perdido' THEN
    IF p_motivo_perda IS NULL THEN RAISE EXCEPTION 'Informe o motivo da perda'; END IF;
    UPDATE public.oportunidades
    SET etapa = 'perdido', motivo_perda = p_motivo_perda, responsavel_id = coalesce(responsavel_id, p_usuario)
    WHERE id = p_oportunidade RETURNING * INTO v_op;
    IF v_op.conversa_id IS NOT NULL THEN
      UPDATE public.conversas
      SET funil = 'arquivado', arquivo_motivo = 'lead_perdido', funil_atualizado_por = p_usuario
      WHERE id = v_op.conversa_id AND customer_id IS NULL;
    END IF;
  ELSE
    UPDATE public.oportunidades
    SET etapa = p_etapa, responsavel_id = coalesce(responsavel_id, p_usuario)
    WHERE id = p_oportunidade RETURNING * INTO v_op;
  END IF;
  RETURN v_op;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Views para as telas e para medir
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_funil_pre_venda AS
SELECT
  tenant_id,
  etapa,
  count(*) AS quantidade,
  coalesce(sum(valor_mensal_estimado), 0) AS valor_mensal_total,
  count(*) FILTER (WHERE proximo_contato_em < current_date AND etapa NOT IN ('ganho', 'perdido')) AS atrasadas
FROM public.oportunidades
GROUP BY tenant_id, etapa;

-- Tempo médio (dias) em cada etapa, a partir do histórico
CREATE OR REPLACE VIEW public.vw_tempo_por_etapa AS
SELECT
  e.tenant_id,
  e.para_etapa AS etapa,
  round(avg(EXTRACT(EPOCH FROM (coalesce(prox.created_at, now()) - e.created_at)) / 86400)::numeric, 1) AS dias_medios,
  count(*) AS passagens
FROM public.oportunidade_eventos e
LEFT JOIN LATERAL (
  SELECT n.created_at FROM public.oportunidade_eventos n
  WHERE n.oportunidade_id = e.oportunidade_id AND n.created_at > e.created_at
  ORDER BY n.created_at LIMIT 1
) prox ON true
WHERE e.para_etapa NOT IN ('ganho', 'perdido')
GROUP BY e.tenant_id, e.para_etapa;

-- ─────────────────────────────────────────────────────────────
-- 5. Classificar as conversas que já existem (gatilho desligado durante a carga)
-- ─────────────────────────────────────────────────────────────
-- Com cliente ou grupo -> atendimento. Sem cliente: tenta vincular pelo telefone;
-- se não achar, as com mensagem nos últimos 30 dias vão para triagem e as mais
-- antigas são arquivadas como 'antigo' (dá para reabrir).
ALTER TABLE public.conversas DISABLE TRIGGER trg_classificar_funil_conversa;

UPDATE public.conversas c
SET customer_id = m.cliente
FROM (
  SELECT id, public.cliente_pelo_telefone(tenant_id, client_phone) AS cliente
  FROM public.conversas
  WHERE funil IS NULL AND customer_id IS NULL AND NOT coalesce(is_group, false)
) m
WHERE c.id = m.id AND m.cliente IS NOT NULL;

UPDATE public.conversas
SET funil = 'atendimento'
WHERE funil IS NULL AND (customer_id IS NOT NULL OR coalesce(is_group, false));

UPDATE public.conversas
SET funil = 'triagem'
WHERE funil IS NULL AND last_message_time >= now() - interval '30 days';

UPDATE public.conversas
SET funil = 'arquivado', arquivo_motivo = 'antigo'
WHERE funil IS NULL;

ALTER TABLE public.conversas ENABLE TRIGGER trg_classificar_funil_conversa;
ALTER TABLE public.conversas ALTER COLUMN funil SET DEFAULT 'triagem';

-- Realtime para o quadro de pré-venda
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'oportunidades'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.oportunidades;
  END IF;
END $$;
