import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findContactTypeMessages() {
  const { data: messages, error } = await supabase
    .from('mensagens')
    .select('id, type, content, media_url, file_name, conversation_id')
    .eq('type', 'contact');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Encontradas ${messages.length} mensagens do tipo contact.`);
  messages.forEach(m => {
    console.log(`ID: ${m.id} | Conteudo: ${m.content} | Conv: ${m.conversation_id}`);
  });
}

findContactTypeMessages();
