const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
  console.log('Criando/Atualizando tabela contacts...');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      instance_name TEXT,
      jid TEXT,
      telefone TEXT,
      telefone_formatado TEXT,
      nome TEXT,
      nome_exibicao TEXT,
      foto_perfil TEXT,
      ddi TEXT,
      ddd TEXT,
      status_normalizacao TEXT,
      tipo_numero TEXT,
      status_validacao TEXT,
      motivo_validacao TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(jid, tenant_id)
    );

    -- Garantir que todos os campos existam (caso a tabela já existisse)
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ddi TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ddd TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status_normalizacao TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tipo_numero TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status_validacao TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS motivo_validacao TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telefone_formatado TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instance_name TEXT;
  `;

  // Executar SQL via RPC se disponível, ou apenas logar instrução
  // Como não temos RPC genérico configurado, vamos tentar usar o apply_migration via run_command se possível, 
  // mas aqui vamos apenas assumir que podemos rodar comandos sql.
  
  // Na verdade, vou usar o comando sql do Supabase CLI se disponível, ou apenas tentar um insert de teste para ver se as colunas existem.
  console.log('SQL a ser executado no painel do Supabase:\n', sql);
}

setup();
