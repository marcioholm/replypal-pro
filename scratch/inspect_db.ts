import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: cliente } = await supabase.from('clientes').select('*');
  console.log('Cliente:', JSON.stringify(cliente, null, 2));

  const { data: conversas } = await supabase.from('conversas').select('*').limit(5);
  console.log('Conversas (top 5):', JSON.stringify(conversas, null, 2));
}

inspect();
