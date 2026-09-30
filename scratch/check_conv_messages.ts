import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConversationMessages() {
  const convId = '16a04f03-9e28-4b01-aea8-e248fa9a96c0';
  const { data: messages, error } = await supabase
    .from('mensagens')
    .select('id, type, content, media_url, file_name')
    .eq('conversation_id', convId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Mensagens da conversa ${convId}:`);
  messages.forEach(m => {
    console.log(`ID: ${m.id} | Tipo: ${m.type} | Conteudo: ${m.content} | FileName: ${m.file_name}`);
  });
}

checkConversationMessages();
