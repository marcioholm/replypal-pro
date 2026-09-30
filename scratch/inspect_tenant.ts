import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: tenant } = await supabase.from('tenants').select('*');
  console.log('Tenant:', JSON.stringify(tenant, null, 2));

  const { data: settings } = await supabase.from('company_settings').select('*');
  console.log('Company Settings:', JSON.stringify(settings, null, 2));
  
  const { data: conversas } = await supabase.from('conversas').select('*');
  console.log('Conversas:', JSON.stringify(conversas, null, 2));
}

inspect();
