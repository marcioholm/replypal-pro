import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTenant() {
  const instanceName = "Sasaki Soluções Contabeis LTDA";
  
  // Try to find the tenant or update it
  // Since we want this to be the active one, we'll update the existing one or insert
  // Let's see what's there first
  const { data: tenants, error: fetchError } = await supabase.from('tenants').select('*');
  
  if (fetchError) {
    console.error("Error fetching tenants:", fetchError);
    return;
  }

  console.log("Current tenants:", tenants);

  if (tenants.length > 0) {
    // Update the first tenant (assuming single tenant setup or updating the main one)
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
    // Insert a default one if none exists
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
