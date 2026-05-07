const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Adding client_avatar column...');
  // Note: Most Supabase setups don't have exec_sql RPC enabled by default for security.
  // But we can try to use a migration file or the SQL Editor.
  // Since I can't use the SQL Editor, I'll try to see if I can run a query.
  
  // In many cases, we can't run DDL via the JS client unless a specific function exists.
  // I'll try to use the 'rpc' method if the user added a helper.
  
  const sql = `ALTER TABLE conversas ADD COLUMN IF NOT EXISTS client_avatar TEXT;`;
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Error adding column:', error);
    console.log('TIP: Please run this in your Supabase SQL Editor:');
    console.log(sql);
  } else {
    console.log('Column added successfully!');
  }
}

run();
