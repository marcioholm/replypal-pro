import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\\n/g, "").replace(/\n/g, "");
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/\\n/g, "").replace(/\n/g, "");

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sql = `
    ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS operational_status text DEFAULT 'Revisão pendente',
    ADD COLUMN IF NOT EXISTS internal_responsible_id uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS internal_responsible_name text,
    ADD COLUMN IF NOT EXISTS sector text,
    ADD COLUMN IF NOT EXISTS fantasy_name text;

    CREATE INDEX IF NOT EXISTS idx_clientes_operational_status ON clientes(operational_status);
    CREATE INDEX IF NOT EXISTS idx_clientes_sector ON clientes(sector);
    CREATE INDEX IF NOT EXISTS idx_clientes_internal_responsible ON clientes(internal_responsible_id);
    
    NOTIFY pgrst, 'reload schema';
  `;
  
  console.log('Running SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Error running migration via RPC:', error);
  } else {
    console.log('Migration successful! Schema cache reloaded.', data);
  }
}

runMigration();
