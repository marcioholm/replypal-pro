import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMensagensSchema() {
  const sql = `
    SELECT
        column_name,
        data_type
    FROM
        information_schema.columns
    WHERE
        table_name = 'mensagens';
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) console.error(error);
  else console.log('Columns in mensagens:', data);
}

checkMensagensSchema();
