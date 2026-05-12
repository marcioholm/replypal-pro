import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findContactMessages() {
  const { data: messages, error } = await supabase
    .from('mensagens')
    .select('id, type, content, media_url, file_name')
    .ilike('content', '%[Contato]%');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Encontradas ${messages.length} mensagens de contato.`);
  messages.forEach(m => {
    console.log(`ID: ${m.id} | Tipo: ${m.type} | Conteudo: ${m.content} | FileName: ${m.file_name}`);
  });
}

findContactMessages();
