-- 010 — Limpeza de segurança
-- O frontend chamava rpc('exec_sql') a cada carregamento para "criar tabelas".
-- Esse código foi removido. Aqui tiramos a permissão de qualquer cliente
-- (anon/authenticated) executar SQL arbitrário por essa função, se ela existir.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'exec_sql' AND n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- O seed antigo regravava a senha do usuário abaixo como "admin123" a cada acesso.
-- Troque a senha dele pela tela do sistema (ou remova o usuário se não for usado):
-- DELETE FROM usuarios WHERE email = 'carlos@sasaki.com';
