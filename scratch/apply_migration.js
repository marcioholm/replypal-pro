import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  logo_url TEXT,
  evolution_url TEXT,
  evolution_api_key TEXT,
  instance_name TEXT DEFAULT 'replypal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;
`;

async function applyMigration() {
  console.log('Aplicando migração para criar company_settings...');
  // Tentar criar via RPC exec_sql se disponível
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('Erro ao aplicar via RPC:', error.message);
    console.log('Tentando verificar se a tabela existe de outra forma...');
    const { error: tableError } = await supabase.from('company_settings').select('count', { count: 'exact', head: true });
    if (tableError) {
      console.error('A tabela realmente não existe e o RPC exec_sql falhou. Por favor, execute o SQL manualmente no dashboard do Supabase.');
    } else {
      console.log('A tabela já existe.');
    }
  } else {
    console.log('✅ Tabela company_settings criada/verificada com sucesso!');
  }
}

applyMigration();
