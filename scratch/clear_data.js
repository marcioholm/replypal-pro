import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://xvvgjeccncfylvvbjgwj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearInbox() {
  console.log('--- Limpando Caixa de Entrada (Conversas e Mensagens) ---');

  // Deletar mensagens ( cascade de conversas costuma resolver, mas vamos garantir)
  const { error: msgError } = await supabase
    .from('mensagens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo

  if (msgError) console.error('Erro ao limpar mensagens:', msgError.message);
  else console.log('✓ Mensagens removidas.');

  const { error: convError } = await supabase
    .from('conversas')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo

  if (convError) console.error('Erro ao limpar conversas:', convError.message);
  else console.log('✓ Conversas removidas.');

  const { error: schedError } = await supabase
    .from('mensagens_agendadas')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo

  if (schedError) console.error('Erro ao limpar mensagens agendadas:', schedError.message);
  else console.log('✓ Mensagens agendadas removidas.');

  console.log('--- Limpeza concluída com sucesso! ---');
}

clearInbox();
