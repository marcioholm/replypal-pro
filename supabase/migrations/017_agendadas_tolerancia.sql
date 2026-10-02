-- ════════════════════════════════════════════════════════════════════════════
-- 017 · Mensagens agendadas: tolerância de atraso
--
-- Se o n8n ficar fora do ar, ao voltar ele NÃO envia mensagens muito atrasadas
-- (um "bom dia" das 9h chegando às 15h). Passadas p_tolerancia_horas (padrão 2)
-- do horário agendado, a mensagem vira "erro" com o motivo e aparece em
-- Agendamentos para a equipe decidir se reenvia.
--
-- Idempotente: pode rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════════════════
-- Garante as colunas que a função usa (o banco de produção pode ter sido criado sem alguma)
ALTER TABLE public.mensagens_agendadas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.mensagens_agendadas ADD COLUMN IF NOT EXISTS error_message TEXT;

DROP FUNCTION IF EXISTS public.reservar_mensagens_agendadas(integer);
DROP FUNCTION IF EXISTS public.reservar_mensagens_agendadas(integer, integer);

CREATE FUNCTION public.reservar_mensagens_agendadas(
  p_limite INTEGER DEFAULT 20,
  p_tolerancia_horas INTEGER DEFAULT 2
)
RETURNS TABLE (
  id UUID, tenant_id UUID, conversa_id UUID, numero TEXT, message_type TEXT,
  text_content TEXT, media_url TEXT, mime_type TEXT, file_name TEXT,
  sender_name TEXT, evolution jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Vencidas além da tolerância: não envia, deixa visível para a equipe.
  UPDATE public.mensagens_agendadas m
     SET status = 'erro',
         error_message = 'Não enviada: passou de ' || p_tolerancia_horas ||
                         ' h do horário agendado (automação fora do ar). Reenvie se ainda fizer sentido.',
         processando_em = NULL,
         updated_at = now()
   WHERE m.status = 'agendada'
     AND m.scheduled_at < now() - make_interval(hours => p_tolerancia_horas)
     AND (m.processando_em IS NULL OR m.processando_em < now() - interval '5 minutes');

  -- 2. As que estão no prazo: reserva com trava (dois disparos não pegam a mesma).
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
