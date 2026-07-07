import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Strip trailing \n or whitespace from environment variables
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

console.log("Supabase URL:", supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  console.log("USERS:");
  console.log(JSON.stringify(users, null, 2));
}

main();
