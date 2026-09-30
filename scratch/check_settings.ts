import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
  const { data, error } = await supabase.from('company_settings').select('*');
  if (error) console.error('Erro:', error.message);
  else console.log('Company Settings:', JSON.stringify(data, null, 2));
}

checkSettings();
