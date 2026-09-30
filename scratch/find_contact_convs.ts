import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findContactConversations() {
  const { data: convs, error } = await supabase
    .from('conversas')
    .select('id, last_message, client_name')
    .ilike('last_message', '%[Contato]%');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Encontradas ${convs.length} conversas com contato no last_message.`);
  convs.forEach(c => {
    console.log(`ID: ${c.id} | LastMsg: ${c.last_message} | Client: ${c.client_name}`);
  });
}

findContactConversations();
