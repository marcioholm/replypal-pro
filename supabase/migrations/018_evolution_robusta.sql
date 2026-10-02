-- ════════════════════════════════════════════════════════════════════════════
-- 018 · Evolution: URL limpa e automações que pulam escritório sem WhatsApp
--
-- - evolution_config devolve só "https://host", mesmo que a URL salva tenha vindo
--   colada do painel (com #:~:text=..., caminho ou barra no final).
-- - Alertas, relatório diário e lembretes da pré-venda ignoram o escritório que
--   não tem URL + chave + instância, em vez de tentar enviar e falhar.
--
-- Mesmo conteúdo que já está na 015 atualizada; este arquivo serve para aplicar
-- só a diferença num banco onde a 015 antiga já rodou. Idempotente.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.evolution_url_limpa(p_url text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN u = '' THEN NULL
    WHEN u LIKE '%#:~:text=%'
      THEN 'https://' || regexp_replace(split_part(split_part(u, '#:~:text=', 2), '&', 1), '^https?://|/.*$', '', 'g')
    ELSE substring(CASE WHEN u ~* '^https?://' THEN u ELSE 'https://' || u END from '^(https?://[^/?#]+)')
  END
  FROM (SELECT trim(coalesce(p_url, '')) AS u) t
$$;

CREATE OR REPLACE FUNCTION public.evolution_config(p_tenant UUID)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'url', public.evolution_url_limpa(evolution_url),
    'apikey', evolution_api_key,
    'instance', nullif(trim(instance_name), '')
  )
  FROM public.company_settings WHERE tenant_id = p_tenant
$$;

CREATE OR REPLACE FUNCTION public.evolution_pronta(p_tenant UUID)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce((
    SELECT public.evolution_url_limpa(evolution_url) IS NOT NULL
       AND coalesce(evolution_api_key, '') <> ''
       AND coalesce(trim(instance_name), '') <> ''
    FROM public.company_settings WHERE tenant_id = p_tenant), false)
$$;

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
      -- dias_semana pode ser text[] (produção) ou jsonb; horário pode ser time ou texto.
      -- to_jsonb e ::text deixam a função igual para os dois formatos.
      AND (a.dias_semana IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(to_jsonb(a.dias_semana)) AS d(dia)
            WHERE d.dia = EXTRACT(DOW FROM agora.local)::int::text))
      AND agora.local::time BETWEEN coalesce(nullif(a.horario_inicio::text, ''), '00:00')::time
                                AND coalesce(nullif(a.horario_fim::text, ''), '23:59')::time
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
    AND public.evolution_pronta(cfg.tenant_id)
    AND u.ultima_em < now() - make_interval(hours => cfg.limite_horas_sem_resposta)
    AND NOT EXISTS (
      SELECT 1 FROM public.alertas_envios e
      WHERE e.alerta_id = cfg.id AND e.conversa_id = u.conversa_id AND e.referencia = u.ultima_em
    )
  ORDER BY u.ultima_em
  LIMIT 50
$$;

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
    AND public.evolution_pronta(r.tenant_id)
    AND (
      (p_teste_tenant IS NOT NULL AND r.tenant_id = p_teste_tenant)
      OR (p_teste_tenant IS NULL AND r.ativo
          AND (now() AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::time >= r.horario
          AND (r.ultimo_envio_em IS NULL
               OR (r.ultimo_envio_em AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::date
                  < (now() AT TIME ZONE coalesce(r.timezone, 'America/Sao_Paulo'))::date))
    )
$$;

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
  WHERE public.evolution_pronta(ops.tenant_id)
$$;

-- Corrige o que já está salvo
UPDATE public.company_settings
   SET evolution_url = public.evolution_url_limpa(evolution_url)
 WHERE evolution_url IS NOT NULL
   AND evolution_url IS DISTINCT FROM public.evolution_url_limpa(evolution_url);
