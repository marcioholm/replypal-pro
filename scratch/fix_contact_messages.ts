import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixContactMessages() {
  console.log('Buscando mensagens de imagem que na verdade são contatos...');
  
  const { data: messages, error } = await supabase
    .from('mensagens')
    .select('id, content')
    .eq('type', 'image')
    .ilike('content', '%[Contato]%');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Encontradas ${messages.length} mensagens para corrigir.`);

  for (const m of messages) {
    console.log(`Corrigindo mensagem ${m.id}...`);
    const name = m.content.replace('[Contato] ', '').trim();
    const { error: uErr } = await supabase
      .from('mensagens')
      .update({ 
        type: 'contact',
        file_name: name
      })
      .eq('id', m.id);
    
    if (uErr) console.error(`Erro ao corrigir: ${uErr.message}`);
  }

  console.log('Correção concluída.');
}

fixContactMessages();
