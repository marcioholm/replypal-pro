import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\\n/g, "").replace(/\n/g, "");
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/\\n/g, "").replace(/\n/g, "");

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

listUsers();
