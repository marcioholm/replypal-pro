const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Simple parser for .env
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTenant() {
  const instanceName = "Sasaki Soluções Contabeis LTDA";
  
  const { data: tenants, error: fetchError } = await supabase.from('tenants').select('*');
  
  if (fetchError) {
    console.error("Error fetching tenants:", fetchError);
    return;
  }

  console.log("Current tenants:", tenants);

  if (tenants.length > 0) {
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ evolution_instance: instanceName })
      .eq('id', tenants[0].id);

    if (updateError) {
      console.error("Error updating tenant:", updateError);
    } else {
      console.log(`Successfully updated tenant ${tenants[0].id} to instance: ${instanceName}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('tenants')
      .insert({ 
        id: '11111111-1111-1111-1111-111111111111', 
        name: 'Sasaki Contabilidade', 
        evolution_instance: instanceName 
      });

    if (insertError) {
      console.error("Error inserting tenant:", insertError);
    } else {
      console.log("Successfully inserted default tenant with instance:", instanceName);
    }
  }
}

updateTenant();
