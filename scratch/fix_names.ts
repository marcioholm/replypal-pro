import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNames() {
  const NAME_TO_FIX = 'Cleyton J.Sasaki - Contador';
  console.log(`Buscando conversas com o nome "${NAME_TO_FIX}"...`);
  
  const { data: conversas, error } = await supabase
    .from('conversas')
    .select('id, client_phone')
    .eq('client_name', NAME_TO_FIX);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Encontradas ${conversas.length} conversas para atualizar.`);

  for (const conv of conversas) {
    console.log(`Atualizando conversa ${conv.id} (Telefone: ${conv.client_phone})...`);
    const { error: uErr } = await supabase
      .from('conversas')
      .update({ client_name: conv.client_phone })
      .eq('id', conv.id);
    
    if (uErr) console.error(`Erro ao atualizar: ${uErr.message}`);
  }

  console.log('Atualização concluída.');
}

fixNames();
