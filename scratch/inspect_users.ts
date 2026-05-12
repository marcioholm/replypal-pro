import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUsers() {
  const { data: usuarios } = await supabase.from('usuarios').select('*');
  console.log('Usuarios:', JSON.stringify(usuarios, null, 2));
}

inspectUsers();
