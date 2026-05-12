import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
`;

async function fixColumns() {
  console.log('Adicionando colunas faltantes em conversas...');
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Erro ao executar SQL:', error.message);
  } else {
    console.log('✅ Colunas adicionadas com sucesso!');
  }
}

fixColumns();
