const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCount() {
  const tenantId = process.env.TENANT_ID || process.env.VITE_TENANT_ID;
  if (!tenantId) {
    console.error('Defina TENANT_ID no .env');
    process.exit(1);
  }
  const { count, error } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Erro ao contar:', error);
    return;
  }

  console.log(`--- DIAGNÓSTICO DE DADOS ---`);
  console.log(`Total real no banco de dados para este tenant: ${count}`);
  console.log(`----------------------------`);
}

checkCount();
