import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- 1. Adicionar restrição de unicidade para evitar duplicatas em requisições paralelas
ALTER TABLE conversas ADD CONSTRAINT unique_client_phone_tenant UNIQUE (client_phone, tenant_id);
`;

async function applyConstraint() {
  console.log('Aplicando restrição de unicidade em conversas...');
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Erro ao aplicar restrição:', error.message);
  } else {
    console.log('✅ Restrição de unicidade aplicada com sucesso!');
  }
}

applyConstraint();
