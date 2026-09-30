import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.from('conversas').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Colunas em conversas:', Object.keys(data[0]));
  } else {
    console.log('Nenhuma conversa para checar colunas.');
  }
}

checkColumns();
