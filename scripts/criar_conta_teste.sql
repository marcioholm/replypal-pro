-- ════════════════════════════════════════════════════════════════════════════
-- Conta+ · Criar um escritório de teste com um usuário admin
--
-- Cria um escritório separado (dados isolados dos outros), um admin para entrar,
-- as configurações em branco e os tipos de documento padrão.
-- Pode rodar de novo: se o escritório ou o e-mail já existirem, só completa o que falta.
--
-- COMO USAR (SQL Editor do Supabase):
--   1. Troque os 4 valores abaixo.
--   2. Rode. O resultado aparece em "Messages"/"Notices".
--   3. Entre no Conta+ com o e-mail e a senha. No primeiro login a senha é
--      convertida para hash automaticamente.
--   4. Em Configurações › WhatsApp, informe a Evolution e a instância de teste.
--
-- O e-mail precisa ser diferente do que você usa em outro escritório
-- (um e-mail = um usuário = um escritório).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_escritorio text := 'Conta+ Teste';
  v_nome       text := 'Gabriel (teste)';
  v_email      text := 'teste@seudominio.com.br';
  v_senha      text := 'TROQUE-ESTA-SENHA';

  v_tenant  uuid;
  v_usuario uuid;
BEGIN
  v_email := lower(trim(v_email));

  IF v_senha = 'TROQUE-ESTA-SENHA' OR length(v_senha) < 8 THEN
    RAISE EXCEPTION 'Defina uma senha com pelo menos 8 caracteres em v_senha.';
  END IF;

  -- Escritório
  SELECT id INTO v_tenant FROM public.tenants WHERE nome = v_escritorio LIMIT 1;
  IF v_tenant IS NULL THEN
    INSERT INTO public.tenants (nome) VALUES (v_escritorio) RETURNING id INTO v_tenant;
    RAISE NOTICE 'Escritório criado: % (%)', v_escritorio, v_tenant;
  ELSE
    RAISE NOTICE 'Escritório já existia: % (%)', v_escritorio, v_tenant;
  END IF;

  -- Usuário admin
  SELECT id INTO v_usuario FROM public.usuarios WHERE lower(email) = v_email;
  IF v_usuario IS NOT NULL THEN
    IF (SELECT tenant_id FROM public.usuarios WHERE id = v_usuario) IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'O e-mail % já pertence a outro escritório. Use outro e-mail para o teste.', v_email;
    END IF;
    RAISE NOTICE 'Usuário já existia: % (senha não foi alterada)', v_email;
  ELSE
    -- "senha" é a coluna legada: o login aceita uma vez e troca por hash + salt.
    EXECUTE 'INSERT INTO public.usuarios (email, nome, role, tenant_id, senha)
             VALUES ($1, $2, ''admin'', $3, $4) RETURNING id'
      INTO v_usuario USING v_email, v_nome, v_tenant, v_senha;
    RAISE NOTICE 'Usuário admin criado: %', v_email;
  END IF;

  -- Configurações em branco (a Evolution é informada na tela)
  INSERT INTO public.company_settings (tenant_id, nome, instance_name)
  VALUES (v_tenant, v_escritorio, NULL)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Tipos de documento padrão (mesmos da migration 013)
  INSERT INTO public.documento_tipos_config (tenant_id, tipo, rotulo, nivel, somente_mes_atual)
  SELECT v_tenant, d.tipo, d.rotulo, d.nivel, d.mes_atual
  FROM (VALUES
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

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'Pronto. Entre no Conta+ com % e a senha definida.', v_email;
  RAISE NOTICE 'Id do escritório de teste: %', v_tenant;
END $$;
