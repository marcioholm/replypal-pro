import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicate() {
  console.log('Buscando conversas duplicadas...');
  const { data: conversas, error } = await supabase
    .from('conversas')
    .select('id, client_phone, tenant_id, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const seen = new Set();
  const duplicates = [];

  for (const conv of conversas) {
    const key = `${conv.client_phone}_${conv.tenant_id}`;
    if (seen.has(key)) {
      duplicates.push(conv);
    } else {
      seen.add(key);
    }
  }

  console.log(`Encontradas ${duplicates.length} conversas duplicadas.`);

  for (const dup of duplicates) {
    // 1. Achar a conversa original (a primeira criada)
    const { data: original } = await supabase
      .from('conversas')
      .select('id')
      .eq('client_phone', dup.client_phone)
      .eq('tenant_id', dup.tenant_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (original && original.id !== dup.id) {
      console.log(`Movendo mensagens da conversa ${dup.id} para ${original.id}...`);
      // 2. Mover mensagens
      const { error: mErr } = await supabase
        .from('mensagens')
        .update({ conversation_id: original.id })
        .eq('conversation_id', dup.id);
      
      if (mErr) console.error(`Erro ao mover mensagens: ${mErr.message}`);

      // 3. Deletar a duplicata
      const { error: dErr } = await supabase
        .from('conversas')
        .delete()
        .eq('id', dup.id);
      
      if (dErr) console.error(`Erro ao deletar duplicata: ${dErr.message}`);
    }
  }

  console.log('Deduplicação concluída.');
}

deduplicate();
