const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking last 5 messages...');
  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching messages:', error);
  } else {
    console.log('Last 5 messages:');
    data.forEach(m => {
      console.log(`- [${m.timestamp}] From: ${m.sender_name} | Content: ${m.content} | Media: ${m.media_url} | Tenant: ${m.tenant_id}`);
    });
  }

  console.log('\nChecking last 5 conversations...');
  const { data: convs, error: convError } = await supabase
    .from('conversas')
    .select('*')
    .order('last_message_time', { ascending: false })
    .limit(5);
  
  if (convError) {
    console.error('Error fetching conversations:', convError);
  } else {
    console.log('Last 5 conversations:');
    convs.forEach(c => {
      console.log(`- [${c.last_message_time}] Phone: ${c.client_phone} | Last: ${c.last_message} | Tenant: ${c.tenant_id}`);
    });
  }
}

check();
