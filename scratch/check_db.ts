import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  const tables = ['clientes', 'conversas', 'mensagens', 'tags', 'historico', 'documentos', 'company_settings', 'usuarios', 'tenants'];
  
  console.log('--- STATUS DO BANCO DE DADOS ---');
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`Tabela ${table}: Erro (${error.message})`);
      } else {
        console.log(`Tabela ${table}: ${count} registros`);
      }
    } catch (e) {
      console.log(`Tabela ${table}: Falha na consulta`);
    }
  }
}

checkDatabase();
