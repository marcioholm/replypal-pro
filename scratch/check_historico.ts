import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistorico() {
  const { data, error } = await supabase
    .from('historico')
    .select('*')
    .limit(1);
  
  if (error) console.error(error);
  else console.log('Sample row from historico:', data);
}

checkHistorico();
