-- 015 — Base para os fluxos do n8n (pasta n8n/ do repositório)
-- Idempotente. Não apaga dados. Pré-requisitos: 011 a 014.
--
-- Regra geral: o n8n NÃO monta SQL solto nem decide regra de negócio. Ele chama as
-- funções abaixo, que recebem o tenant e devolvem só o que aquele escritório pode ver.
-- Fuso de todas as datas de negócio: America/Sao_Paulo.

-- ─────────────────────────────────────────────────────────────
-- 0. Tabelas usadas pelo app/n8n que nunca tiveram DDL no repositório
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conhecimento_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  conteudo TEXT NOT NULL,
  palavras_chave TEXT[],
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativo',
  origem TEXT NOT NULL DEFAULT 'manual',
  nivel_confianca TEXT NOT NULL DEFAULT 'alta',
  data_validade TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  criado_por UUID REFERENCES public.usuarios(id),
  atualizado_por UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historico_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automacoes_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'cliente_sem_resposta',
  ativo BOOLEAN NOT NULL DEFAULT false,
  limite_horas_sem_resposta INTEGER NOT NULL DEFAULT 48,
  numero_destino TEXT,
  dias_semana JSONB NOT NULL DEFAULT '["1","2","3","4","5"]',
  horario_inicio TEXT DEFAULT '08:00',
  horario_fim TEXT DEFAULT '18:00',
  mensagem_template TEXT,
  configuracao JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automacoes_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'resumo_diario_atendimento',
  nome TEXT NOT NULL DEFAULT 'Relatório Diário de Atendimento',
  ativo BOOLEAN NOT NULL DEFAULT true,
  horario TIME NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  mensagem_intro TEXT,
  incluir_resumo_geral BOOLEAN NOT NULL DEFAULT true,
  incluir_por_usuario BOOLEAN NOT NULL DEFAULT true,
  incluir_pendentes BOOLEAN NOT NULL DEFAULT true,
  incluir_tempo_resposta BOOLEAN NOT NULL DEFAULT true,
  incluir_alertas BOOLEAN NOT NULL DEFAULT true,
  numeros_destino JSONB NOT NULL DEFAULT '[]',
  numero_destino TEXT,
  numero_gerencia TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.automacoes_relatorios ADD COLUMN IF NOT EXISTS ultimo_envio_em TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacoes_relatorios_tipo ON public.automacoes_relatorios (tenant_id, tipo);

CREATE TABLE IF NOT EXISTS public.relatorios_envios_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  relatorio_id UUID REFERENCES public.automacoes_relatorios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'resumo_diario_atendimento',
  numero_destino TEXT NOT NULL,
  nome_destinatario TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('enviado', 'erro', 'pendente')),
  erro TEXT,
  response_json JSONB,
  enviado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relatorios_logs_tenant ON public.relatorios_envios_logs (tenant_id, enviado_em DESC);

-- Um alerta por conversa por "episódio" (muda quando o cliente manda mensagem nova)
CREATE TABLE IF NOT EXISTS public.alertas_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alerta_id UUID NOT NULL REFERENCES public.automacoes_alertas(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  referencia TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'erro')),
  erro TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE (alerta_id, conversa_id, referencia)
);

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS whatsapp TEXT;  -- já usada pelo app

-- Mensagens agendadas: trava para o n8n não enviar duas vezes
ALTER TABLE public.mensagens_agendadas ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.mensagens_agendadas ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.mensagens_agendadas ADD COLUMN IF NOT EXISTS processando_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_mensagens_agendadas_fila
  ON public.mensagens_agendadas (scheduled_at) WHERE status = 'agendada';

-- Documentos: caminho no Storage (bucket privado "documentos")
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tamanho_bytes BIGINT;

-- A view da 012 usa d.*, que o Postgres congela na criação: recria para
-- incluir as colunas novas (storage_path é lido por /api/documento-url).
DROP VIEW IF EXISTS public.vw_documentos_cliente;
CREATE VIEW public.vw_documentos_cliente AS
SELECT
  d.*,
  public.area_do_documento(d.categoria, d.tipo) AS area,
  public.area_restrita(public.area_do_documento(d.categoria, d.tipo)) AS restrito
FROM public.documentos d;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 1. Helpers comuns
-- ─────────────────────────────────────────────────────────────

-- Configuração da Evolution do escritório
CREATE OR REPLACE FUNCTION public.evolution_config(p_tenant UUID)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'url', rtrim(evolution_url, '/'),
    'apikey', evolution_api_key,
    'instance', instance_name
  )
  FROM public.company_settings WHERE tenant_id = p_tenant
$$;

-- Número no formato que a Evolution espera (55 + DDD + número)
CREATE OR REPLACE FUNCTION public.telefone_whatsapp(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN d ~ '@' THEN p
    WHEN length(d) IN (10, 11) THEN '55' || d
    ELSE d END
  FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9@a-z.]', '', 'g') AS d) t
$$;

-- Grava uma mensagem enviada por automação no chat e atualiza a conversa
CREATE OR REPLACE FUNCTION public.registrar_mensagem_automatica(
  p_conversa UUID, p_texto TEXT, p_sender_name TEXT DEFAULT 'Conta+ (automático)',
  p_tipo TEXT DEFAULT 'text', p_media_url TEXT DEFAULT NULL, p_file_name TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL, p_novo_status TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant UUID;
  v_id UUID;
  v_resumo TEXT := coalesce(nullif(p_texto, ''), '[' || coalesce(p_file_name, 'Arquivo') || ']');
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.conversas WHERE id = p_conversa;
  IF v_tenant IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.mensagens (conversation_id, content, sender, sender_name, type, media_url,
                                file_name, external_message_id, status, tenant_id, timestamp)
  VALUES (p_conversa, v_resumo, 'agent', p_sender_name, p_tipo, p_media_url,
          p_file_name, p_external_id, 'sent', v_tenant, now())
  ON CONFLICT (external_message_id) DO NOTHING
  RETURNING id INTO v_id;

  UPDATE public.conversas
  SET last_message = v_resumo,
      last_message_time = now(),
      status = coalesce(p_novo_status, status)
  WHERE id = p_conversa;
  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Mensagens agendadas (fluxo 04)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservar_mensagens_agendadas(p_limite INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID, tenant_id UUID, conversa_id UUID, numero TEXT, message_type TEXT,
  text_content TEXT, media_url TEXT, mime_type TEXT, file_name TEXT,
  sender_name TEXT, evolution jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH alvo AS (
    SELECT m.id FROM public.mensagens_agendadas m
    WHERE m.status = 'agendada'
      AND m.scheduled_at <= now()
      AND m.tentativas < 3
      AND (m.processando_em IS NULL OR m.processando_em < now() - interval '5 minutes')
    ORDER BY m.scheduled_at
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE public.mensagens_agendadas m
    SET processando_em = now(), tentativas = m.tentativas + 1
    FROM alvo WHERE m.id = alvo.id
    RETURNING m.*
  )
  SELECT mk.id, mk.tenant_id, mk.conversa_id, public.telefone_whatsapp(mk.receiver_number),
         mk.message_type, mk.text_content, mk.media_url, mk.mime_type, mk.file_name,
         coalesce(mk.sender_name, u.nome, 'Agendamento'), public.evolution_config(mk.tenant_id)
  FROM marcadas mk
  LEFT JOIN public.usuarios u ON u.id = mk.created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.concluir_mensagem_agendada(
  p_id UUID, p_ok BOOLEAN, p_erro TEXT DEFAULT NULL, p_external_id TEXT DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  m public.mensagens_agendadas;
BEGIN
  SELECT * INTO m FROM public.mensagens_agendadas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'nao_encontrada'; END IF;

  IF p_ok THEN
    UPDATE public.mensagens_agendadas
    SET status = 'enviada', sent_at = now(), processando_em = NULL, error_message = NULL
    WHERE id = p_id;
    IF m.conversa_id IS NOT NULL THEN
      PERFORM public.registrar_mensagem_automatica(
        m.conversa_id, m.text_content, coalesce(m.sender_name, 'Agendamento'),
        coalesce(m.message_type, 'text'), m.media_url, m.file_name, p_external_id, 'aguardando_cliente');
    END IF;
    RETURN 'enviada';
  END IF;

  UPDATE public.mensagens_agendadas
  SET status = CASE WHEN m.tentativas >= 3 THEN 'erro' ELSE 'agendada' END,
      processando_em = NULL,
      error_message = left(coalesce(p_erro, 'Erro ao enviar'), 500)
  WHERE id = p_id;
  RETURN CASE WHEN m.tentativas >= 3 THEN 'erro' ELSE 'nova_tentativa' END;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Alertas de atendimento (fluxo 05)
-- ─────────────────────────────────────────────────────────────
-- Conversas de cliente (funil atendimento) cuja última mensagem é do CLIENTE e está sem
-- resposta há mais que o limite, dentro dos dias/horário configurados, ainda não alertadas.
CREATE OR REPLACE FUNCTION public.alertas_devidos()
RETURNS TABLE (
  alerta_id UUID, tenant_id UUID, conversa_id UUID, referencia TIMESTAMPTZ,
  numero_destino TEXT, mensagem TEXT, evolution jsonb
)
LANGUAGE sql STABLE
AS $$
  WITH agora AS (SELECT now() AT TIME ZONE 'America/Sao_Paulo' AS local),
  cfg AS (
    SELECT a.* FROM public.automacoes_alertas a, agora
    WHERE a.ativo
      AND a.tipo = 'cliente_sem_resposta'
      AND coalesce(a.numero_destino, '') <> ''
      AND a.dias_semana ? EXTRACT(DOW FROM agora.local)::int::text
      AND agora.local::time BETWEEN coalesce(nullif(a.horario_inicio, ''), '00:00')::time
                                AND coalesce(nullif(a.horario_fim, ''), '23:59')::time
  ),
  ultima AS (
    SELECT c.id AS conversa_id, c.tenant_id, c.client_name, c.status, c.created_at, c.assigned_to,
           lm.sender, lm.timestamp AS ultima_em
    FROM public.conversas c
    JOIN LATERAL (
      SELECT m.sender, m.timestamp FROM public.mensagens m
      WHERE m.conversation_id = c.id AND coalesce(m.type, 'text') NOT IN ('reaction', 'revoke')
        -- resposta automática do bot não conta como atendimento humano
        AND coalesce(m.sender_name, '') <> 'Conta+ (automático)'
      ORDER BY m.timestamp DESC LIMIT 1
    ) lm ON true
    WHERE c.funil = 'atendimento'
      AND c.status <> 'resolvido'
      AND NOT coalesce(c.is_group, false)
      AND c.tenant_id IN (SELECT tenant_id FROM cfg)
  )
  SELECT
    cfg.id, cfg.tenant_id, u.conversa_id, u.ultima_em,
    public.telefone_whatsapp(cfg.numero_destino),
    replace(replace(replace(replace(replace(replace(
      coalesce(cfg.mensagem_template,
        'ALERTA DE ATENDIMENTO' || chr(10) || chr(10) ||
        'O cliente {cliente_nome} está há {horas_sem_resposta} horas sem resposta.' || chr(10) ||
        'Responsável: {responsavel_nome}' || chr(10) || 'Status: {status}'),
      '{cliente_nome}', coalesce(u.client_name, 'Cliente')),
      '{horas_sem_resposta}', floor(EXTRACT(EPOCH FROM (now() - u.ultima_em)) / 3600)::int::text),
      '{responsavel_nome}', coalesce(us.nome, 'ninguém (na fila)')),
      '{status}', replace(coalesce(u.status, ''), '_', ' ')),
      '{created_at}', to_char(u.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')),
      E'\\n', chr(10)),  -- o modelo padrão antigo foi gravado com "\n" literal
    public.evolution_config(cfg.tenant_id)
  FROM cfg
  JOIN ultima u ON u.tenant_id = cfg.tenant_id
  LEFT JOIN public.usuarios us ON us.id = u.assigned_to
  WHERE u.sender = 'client'
    AND u.ultima_em < now() - make_interval(hours => cfg.limite_horas_sem_resposta)
    AND NOT EXISTS (
      SELECT 1 FROM public.alertas_envios e
      WHERE e.alerta_id = cfg.id AND e.conversa_id = u.conversa_id AND e.referencia = u.ultima_em
    )
  ORDER BY u.ultima_em
  LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.registrar_alerta(
  p_alerta UUID, p_conversa UUID, p_referencia TIMESTAMPTZ, p_ok BOOLEAN, p_erro TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.alertas_envios (tenant_id, alerta_id, conversa_id, referencia, status, erro)
  SELECT a.tenant_id, p_alerta, p_conversa, p_referencia,
         CASE WHEN p_ok THEN 'enviado' ELSE 'erro' END, left(p_erro, 500)
  FROM public.automacoes_alertas a WHERE a.id = p_alerta
  ON CONFLICT (alerta_id, conversa_id, referencia) DO NOTHING
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Relatório diário (fluxo 06)
-- ─────────────────────────────────────────────────────────────
-- Números do atendimento de um dia (fuso de Brasília)
CREATE OR REPLACE FUNCTION public.relatorio_atendimento_dados(p_tenant UUID, p_dia DATE)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  WITH janela AS (
    SELECT (p_dia::timestamp AT TIME ZONE 'America/Sao_Paulo') AS ini,
           ((p_dia + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS fim
  ),
  conv AS (
    SELECT c.* FROM public.conversas c
    WHERE c.tenant_id = p_tenant AND NOT coalesce(c.is_group, false)
      AND coalesce(c.funil, 'atendimento') = 'atendimento'
  ),
  primeira_resposta AS (
    SELECT c.id,
           (SELECT min(m.timestamp) FROM public.mensagens m, janela
             WHERE m.conversation_id = c.id AND m.sender = 'client'
               AND m.timestamp >= janela.ini AND m.timestamp < janela.fim) AS cliente_em,
           (SELECT min(m.timestamp) FROM public.mensagens m, janela
             WHERE m.conversation_id = c.id AND m.sender = 'agent'
               AND coalesce(m.sender_name, '') <> 'Conta+ (automático)'
               AND m.timestamp >= janela.ini AND m.timestamp < janela.fim) AS agente_em
    FROM conv c
  ),
  tempos AS (
    SELECT EXTRACT(EPOCH FROM (agente_em - cliente_em)) / 60 AS minutos
    FROM primeira_resposta WHERE cliente_em IS NOT NULL AND agente_em > cliente_em
  )
  SELECT jsonb_build_object(
    'dia', to_char(p_dia, 'DD/MM/YYYY'),
    'novas', (SELECT count(*) FROM conv, janela WHERE conv.created_at >= janela.ini AND conv.created_at < janela.fim),
    'resolvidas', (SELECT count(*) FROM conv, janela WHERE conv.resolved_at >= janela.ini AND conv.resolved_at < janela.fim),
    'abertas_agora', (SELECT count(*) FROM conv WHERE status <> 'resolvido'),
    'na_fila', (SELECT count(*) FROM conv WHERE status <> 'resolvido' AND assigned_to IS NULL),
    'sla_estourado', (SELECT count(*) FROM conv WHERE status <> 'resolvido' AND sla_deadline < now()),
    'triagem', (SELECT count(*) FROM public.conversas WHERE tenant_id = p_tenant AND funil = 'triagem'),
    'tempo_medio_primeira_resposta_min', (SELECT round(avg(minutos)::numeric, 0) FROM tempos),
    'por_usuario', coalesce((
      SELECT jsonb_agg(jsonb_build_object('nome', u.nome, 'resolvidas', x.resolvidas, 'abertas', x.abertas)
                       ORDER BY x.resolvidas DESC, u.nome)
      FROM (
        SELECT assigned_to,
               count(*) FILTER (WHERE resolved_at >= j.ini AND resolved_at < j.fim) AS resolvidas,
               count(*) FILTER (WHERE status <> 'resolvido') AS abertas
        FROM conv, janela j WHERE assigned_to IS NOT NULL GROUP BY assigned_to
      ) x JOIN public.usuarios u ON u.id = x.assigned_to
      WHERE x.resolvidas > 0 OR x.abertas > 0
    ), '[]'::jsonb),
    'pendentes_mais_antigas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('cliente', client_name,
                         'desde', to_char(last_message_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')))
      FROM (SELECT client_name, last_message_time FROM conv
            WHERE status <> 'resolvido' ORDER BY last_message_time LIMIT 5) p
    ), '[]'::jsonb)
  )
$$;

-- Relatórios que precisam sair agora (ou o de um tenant específico, para teste)
CREATE OR REPLACE FUNCTION public.relatorios_devidos(p_teste_tenant UUID DEFAULT NULL)
RETURNS TABLE (
  relatorio_id UUID, tenant_id UUID, nome TEXT, mensagem_intro TEXT, opcoes jsonb,
  destinos jsonb, dados jsonb, evolution jsonb, teste BOOLEAN
)
LANGUAGE sql STABLE
AS $$
  SELECT r.id, r.tenant_id, r.nome, r.mensagem_intro,
    jsonb_build_object(
      'resumo_geral', r.incluir_resumo_geral, 'por_usuario', r.incluir_por_usuario,
      'pendentes', r.incluir_pendentes, 'tempo_resposta', r.incluir_tempo_resposta,
      'alertas', r.incluir_alertas),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object('nome', d->>'nome', 'numero', public.telefone_whatsapp(d->>'numero')))
      FROM jsonb_array_elements(r.numeros_destino) d
      WHERE coalesce((d->>'ativo')::boolean, true) AND length(regexp_replace(d->>'numero', '\D', '', 'g')) >= 10
    ), '[]'::jsonb),
    -- o relatório da manhã fala do dia anterior
    public.relatorio_atendimento_dados(r.tenant_id, ((now() AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::date - 1)),
    public.evolution_config(r.tenant_id),
    p_teste_tenant IS NOT NULL
  FROM public.automacoes_relatorios r
  WHERE r.tipo = 'resumo_diario_atendimento'
    AND (
      (p_teste_tenant IS NOT NULL AND r.tenant_id = p_teste_tenant)
      OR (p_teste_tenant IS NULL AND r.ativo
          AND (now() AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::time >= r.horario
          AND (r.ultimo_envio_em IS NULL
               OR (r.ultimo_envio_em AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::date
                  < (now() AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::date))
    )
$$;

CREATE OR REPLACE FUNCTION public.registrar_envio_relatorio(
  p_relatorio UUID, p_numero TEXT, p_nome TEXT, p_ok BOOLEAN, p_erro TEXT DEFAULT NULL,
  p_resposta jsonb DEFAULT NULL, p_teste BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.automacoes_relatorios WHERE id = p_relatorio;
  INSERT INTO public.relatorios_envios_logs (tenant_id, relatorio_id, tipo, numero_destino, nome_destinatario, status, erro, response_json)
  VALUES (v_tenant, p_relatorio, CASE WHEN p_teste THEN 'teste' ELSE 'resumo_diario_atendimento' END,
          p_numero, p_nome, CASE WHEN p_ok THEN 'enviado' ELSE 'erro' END, left(p_erro, 500), p_resposta);
  IF NOT p_teste THEN
    UPDATE public.automacoes_relatorios SET ultimo_envio_em = now() WHERE id = p_relatorio;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Assistente de IA interno (fluxo 01)
-- ─────────────────────────────────────────────────────────────
-- A IA não escreve SQL: primeiro classifica a pergunta, depois o n8n chama esta função
-- com a intenção e o termo, e só então a IA responde com o contexto devolvido.
-- Tudo filtrado pelo tenant. Intenções: carteira, cliente, financeiro, documentos,
-- atendimento, conhecimento.
CREATE OR REPLACE FUNCTION public.ia_contexto(
  p_tenant UUID, p_intencao TEXT, p_termo TEXT DEFAULT NULL, p_cliente UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_cliente UUID := p_cliente;
  v_candidatos jsonb;
  v_termo TEXT := nullif(trim(coalesce(p_termo, '')), '');
  v_digitos TEXT := nullif(regexp_replace(coalesce(p_termo, ''), '\D', '', 'g'), '');
  v_out jsonb := '{}'::jsonb;
BEGIN
  -- Resolve o cliente pelo termo (nome, razão social ou CNPJ) quando não veio o id
  IF v_cliente IS NULL AND v_termo IS NOT NULL AND p_intencao IN ('cliente', 'financeiro', 'documentos', 'atendimento') THEN
    SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome_fantasia, 'cnpj', cnpj) ORDER BY nome_fantasia)
      INTO v_candidatos
    FROM (
      SELECT id, nome_fantasia, cnpj FROM public.clientes
      WHERE tenant_id = p_tenant
        AND (nome_fantasia ILIKE '%' || v_termo || '%' OR razao_social ILIKE '%' || v_termo || '%'
             OR (v_digitos IS NOT NULL AND length(v_digitos) >= 5
                 AND regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') LIKE '%' || v_digitos || '%'))
      LIMIT 5
    ) c;
    IF jsonb_array_length(coalesce(v_candidatos, '[]')) = 1 THEN
      v_cliente := (v_candidatos->0->>'id')::uuid;
    ELSIF jsonb_array_length(coalesce(v_candidatos, '[]')) > 1 THEN
      RETURN jsonb_build_object('precisa_escolher', true, 'clientes', v_candidatos);
    ELSE
      RETURN jsonb_build_object('nao_encontrado', true, 'termo', v_termo);
    END IF;
  END IF;

  IF v_cliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = v_cliente AND tenant_id = p_tenant) THEN
    RETURN jsonb_build_object('nao_encontrado', true);
  END IF;

  IF p_intencao = 'carteira' THEN
    v_out := jsonb_build_object(
      'clientes_por_status', (SELECT jsonb_object_agg(coalesce(status, 'Sem status'), n) FROM
         (SELECT status, count(*) n FROM public.clientes WHERE tenant_id = p_tenant GROUP BY status) s),
      'clientes_por_regime', (SELECT jsonb_object_agg(coalesce(regime_tributario, 'Não informado'), n) FROM
         (SELECT regime_tributario, count(*) n FROM public.clientes WHERE tenant_id = p_tenant GROUP BY regime_tributario) r),
      'inadimplentes', (SELECT jsonb_agg(nome_fantasia) FROM
         (SELECT nome_fantasia FROM public.clientes WHERE tenant_id = p_tenant AND financial_status = 'Inadimplente' ORDER BY nome_fantasia LIMIT 30) i),
      'faturamento_mes_anterior_lancado', (SELECT count(DISTINCT cliente_id) FROM public.dados_financeiros
         WHERE tenant_id = p_tenant
           AND make_date(ano, mes, 1) = date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month')::date));
  END IF;

  IF v_cliente IS NOT NULL THEN
    v_out := v_out || jsonb_build_object('cliente', (
      SELECT jsonb_build_object('nome', nome_fantasia, 'razao_social', razao_social, 'cnpj', cnpj,
             'regime', regime_tributario, 'status', status, 'financeiro', financial_status,
             'cidade', cidade, 'responsavel', responsavel, 'observacoes', observations)
      FROM public.clientes WHERE id = v_cliente));

    IF p_intencao IN ('cliente', 'financeiro') THEN
      v_out := v_out || jsonb_build_object('financeiro_12_meses', coalesce((
        SELECT jsonb_agg(jsonb_build_object('competencia', to_char(make_date(ano, mes, 1), 'MM/YYYY'),
                 'faturamento', faturamento, 'compras', compras, 'vendas', vendas, 'folha', folha_pagamento)
               ORDER BY ano DESC, mes DESC)
        FROM (SELECT * FROM public.dados_financeiros WHERE cliente_id = v_cliente
              ORDER BY ano DESC, mes DESC LIMIT 12) f), '[]'::jsonb));
    END IF;

    IF p_intencao IN ('cliente', 'documentos') THEN
      v_out := v_out || jsonb_build_object('documentos_recentes', coalesce((
        SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'arquivo', nome_arquivo,
                 'competencia', CASE WHEN mes IS NOT NULL THEN lpad(mes::text, 2, '0') || '/' || ano END,
                 'enviado_em', to_char(uploaded_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
                 'vigente', vigente))
        FROM (SELECT * FROM public.documentos WHERE cliente_id = v_cliente
              ORDER BY uploaded_at DESC LIMIT 10) d), '[]'::jsonb));
    END IF;

    IF p_intencao IN ('cliente', 'atendimento') THEN
      v_out := v_out || jsonb_build_object('atendimentos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('status', status, 'ultima_mensagem', left(last_message, 200),
                 'quando', to_char(last_message_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')))
        FROM (SELECT * FROM public.conversas WHERE customer_id = v_cliente
              ORDER BY last_message_time DESC LIMIT 5) c), '[]'::jsonb));
    END IF;
  END IF;

  IF p_intencao = 'atendimento' AND v_cliente IS NULL THEN
    v_out := v_out || public.relatorio_atendimento_dados(p_tenant, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  END IF;

  -- Base de conhecimento: sempre que houver termo (ou pergunta de conhecimento)
  IF v_termo IS NOT NULL OR p_intencao = 'conhecimento' THEN
    v_out := v_out || jsonb_build_object('conhecimento', coalesce((
      SELECT jsonb_agg(jsonb_build_object('titulo', titulo, 'categoria', categoria, 'conteudo', left(conteudo, 1500)))
      FROM (
        SELECT titulo, categoria, conteudo FROM public.conhecimento_ia k
        WHERE k.tenant_id = p_tenant AND k.status = 'ativo' AND NOT coalesce(k.is_deleted, false)
          AND (k.data_validade IS NULL OR k.data_validade > now())
          AND (k.cliente_id IS NULL OR k.cliente_id = v_cliente)
          AND (v_termo IS NULL
               OR k.titulo ILIKE '%' || v_termo || '%' OR k.conteudo ILIKE '%' || v_termo || '%'
               OR v_termo ILIKE ANY (SELECT '%' || p || '%' FROM unnest(coalesce(k.palavras_chave, '{}')) p))
        ORDER BY (k.cliente_id IS NOT NULL) DESC, k.updated_at DESC
        LIMIT 5
      ) kk), '[]'::jsonb));
  END IF;

  RETURN v_out;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Lembretes de pré-venda (fluxo 08, opcional)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lembretes_pre_venda()
RETURNS TABLE (tenant_id UUID, destinos jsonb, texto TEXT, evolution jsonb)
LANGUAGE sql STABLE
AS $$
  WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  ops AS (
    SELECT o.tenant_id,
           string_agg('• ' || o.nome_contato || coalesce(' (' || o.empresa_nome || ')', '') ||
                      ' · ' || replace(o.etapa, '_', ' ') ||
                      CASE WHEN o.proximo_contato_em < hoje.d THEN ' · ATRASADO desde ' || to_char(o.proximo_contato_em, 'DD/MM')
                           ELSE '' END ||
                      coalesce(chr(10) || '  Próximo passo: ' || o.proximo_passo, ''),
                      chr(10) ORDER BY o.proximo_contato_em) AS lista,
           count(*) AS n
    FROM public.oportunidades o, hoje
    WHERE o.etapa NOT IN ('ganho', 'perdido') AND o.proximo_contato_em <= hoje.d
    GROUP BY o.tenant_id
  )
  SELECT ops.tenant_id,
         (SELECT jsonb_agg(public.telefone_whatsapp(u.whatsapp)) FROM public.usuarios u
           WHERE u.tenant_id = ops.tenant_id AND u.role IN ('admin', 'supervisor')
             AND length(regexp_replace(coalesce(u.whatsapp, ''), '\D', '', 'g')) >= 10),
         'Pré-venda de hoje: ' || ops.n || ' contato(s) para fazer' || chr(10) || chr(10) || ops.lista,
         public.evolution_config(ops.tenant_id)
  FROM ops
$$;
