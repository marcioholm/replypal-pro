-- ════════════════════════════════════════════════════════════════════════════
-- Conta+ · Limpar os dados de um escritório (recomeçar do zero)
--
-- APAGA: clientes, contatos, conversas, mensagens, histórico, documentos (registros),
--        financeiro, oportunidades, pedidos de documento, agendamentos, logs, contadores.
-- MANTÉM: o escritório (tenants), usuários, configurações (company_settings),
--         tipos de documento, alertas, relatório diário, base de conhecimento e etiquetas.
--
-- NÃO apaga arquivos do Storage (buckets "documentos" e "chat-media"): esvazie-os
-- pelo painel do Supabase em Storage, se quiser liberar espaço.
--
-- COMO USAR (SQL Editor do Supabase):
--   1. Faça um backup antes: Database › Backups (ou exporte as tabelas).
--   2. Descubra o id do escritório:   SELECT id, nome FROM public.tenants;
--   3. Cole o id em v_tenant abaixo e rode com v_executar := false.
--      Isso só CONTA o que seria apagado (aba "Messages"/"Notices").
--   4. Confira os números. Troque para v_executar := true e rode de novo.
--
-- Tudo roda numa transação só: se qualquer tabela falhar, nada é apagado.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tenant            text    := 'COLE-O-ID-DO-ESCRITORIO-AQUI';
  v_executar          boolean := false;  -- false = só contar; true = apagar de verdade
  -- Dados antigos gravados sem escritório (tenant_id vazio). Só ligue se o banco
  -- tiver UM escritório, senão você apaga dados sem dono de todos.
  v_incluir_sem_dono  boolean := false;

  v_manter   text[] := ARRAY[
    'tenants', 'usuarios', 'company_settings', 'documento_tipos_config',
    'automacoes_alertas', 'automacoes_relatorios', 'conhecimento_ia', 'tags'
  ];
  v_pendentes text[];
  v_restantes text[];
  v_tabela    text;
  v_filtro    text;
  v_n         bigint;
  v_orfaos    bigint;
  v_total     bigint := 0;
  v_passada   int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id::text = v_tenant) THEN
    RAISE EXCEPTION 'Escritório "%" não existe. Rode: SELECT id, nome FROM public.tenants;', v_tenant;
  END IF;

  IF v_incluir_sem_dono AND (SELECT count(*) FROM public.tenants) > 1 THEN
    RAISE EXCEPTION 'v_incluir_sem_dono só pode ser usado quando existe um único escritório.';
  END IF;

  -- Toda tabela do schema public que tem tenant_id, menos as que ficam
  SELECT array_agg(c.table_name::text ORDER BY c.table_name)
    INTO v_pendentes
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND c.column_name = 'tenant_id'
    AND t.table_type = 'BASE TABLE'
    AND NOT (c.table_name = ANY (v_manter));

  v_filtro := CASE WHEN v_incluir_sem_dono
                   THEN '(tenant_id::text = $1 OR tenant_id IS NULL)'
                   ELSE 'tenant_id::text = $1' END;

  -- ── Só contar ────────────────────────────────────────────────────────────
  IF NOT v_executar THEN
    FOREACH v_tabela IN ARRAY v_pendentes LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id::text = $1', v_tabela)
        INTO v_n USING v_tenant;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id IS NULL', v_tabela)
        INTO v_orfaos;
      v_total := v_total + v_n;
      IF v_n > 0 OR v_orfaos > 0 THEN
        RAISE NOTICE '% : % linha(s) do escritório | % sem dono', rpad(v_tabela, 26), v_n, v_orfaos;
      END IF;
    END LOOP;
    RAISE NOTICE '────────────────────────────────────────────';
    RAISE NOTICE 'SIMULAÇÃO: % linha(s) seriam apagadas. Nada foi alterado.', v_total;
    RAISE NOTICE 'Para apagar, troque v_executar para true e rode de novo.';
    RETURN;
  END IF;

  -- ── Apagar ───────────────────────────────────────────────────────────────
  -- A ordem depende das chaves estrangeiras: tenta todas; as que falharem por
  -- dependência ficam para a próxima passada, depois que as "filhas" saíram.
  WHILE array_length(v_pendentes, 1) > 0 AND v_passada < 10 LOOP
    v_passada := v_passada + 1;
    v_restantes := ARRAY[]::text[];
    FOREACH v_tabela IN ARRAY v_pendentes LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE %s', v_tabela, v_filtro) USING v_tenant;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_total := v_total + v_n;
        IF v_n > 0 THEN
          RAISE NOTICE '% : % linha(s) apagada(s)', rpad(v_tabela, 26), v_n;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN
        v_restantes := v_restantes || v_tabela;
      END;
    END LOOP;
    EXIT WHEN array_length(v_restantes, 1) IS NOT DISTINCT FROM array_length(v_pendentes, 1);
    v_pendentes := v_restantes;
  END LOOP;

  IF array_length(v_restantes, 1) > 0 THEN
    RAISE EXCEPTION 'Não foi possível apagar: %. Outra tabela (sem tenant_id) ainda aponta para elas. Nada foi apagado.',
      array_to_string(v_restantes, ', ');
  END IF;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'Concluído: % linha(s) apagada(s). Usuários e configurações foram mantidos.', v_total;
END $$;
