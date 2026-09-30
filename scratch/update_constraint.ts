import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateConstraint() {
  const sql = `
    ALTER TABLE mensagens DROP CONSTRAINT IF EXISTS mensagens_type_check;
    ALTER TABLE mensagens ADD CONSTRAINT mensagens_type_check 
    CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact'));
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) console.error(error);
  else console.log('Constraint updated successfully:', data);
}

updateConstraint();
