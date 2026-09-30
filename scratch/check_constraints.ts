import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  const sql = `
    SELECT
        conname,
        pg_get_constraintdef(oid)
    FROM
        pg_constraint
    WHERE
        conrelid = 'mensagens'::regclass;
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) console.error(error);
  else console.log('Constraints on mensagens:', data);
}

checkConstraints();
