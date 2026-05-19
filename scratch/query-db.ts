import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS start_date DATE;
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error("Error executing query:", error);
  } else {
    console.log("Success! Columns updated:", data);
  }
}

run();
