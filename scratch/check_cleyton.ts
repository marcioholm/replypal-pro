import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCleyton() {
  const { data: conversas } = await supabase
    .from('conversas')
    .select('*')
    .ilike('client_name', '%Cleyton%');
  
  console.log('Conversas do Cleyton:', JSON.stringify(conversas, null, 2));
}

checkCleyton();
