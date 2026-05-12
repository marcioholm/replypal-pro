import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log('--- EXECUTANDO LIMPEZA DE DADOS (ROUND 2) ---');
  
  try {
    // 1. Limpar mensagens agendadas (dependem de conversas)
    const { error: err0 } = await supabase.from('mensagens_agendadas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err0) console.log('Aviso: Tabela mensagens_agendadas não existe ou erro:', err0.message);
    else console.log('✅ Mensagens agendadas limpas');

    // 2. Limpar mensagens (dependem de conversas)
    const { error: err1 } = await supabase.from('mensagens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err1) console.error('Erro ao limpar mensagens:', err1.message);
    else console.log('✅ Mensagens limpas');

    // 3. Limpar conversas
    const { error: err2 } = await supabase.from('conversas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err2) console.error('Erro ao limpar conversas:', err2.message);
    else console.log('✅ Conversas limpas');

    // 4. Limpar clientes
    const { error: err3 } = await supabase.from('clientes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err3) console.error('Erro ao limpar clientes:', err3.message);
    else console.log('✅ Clientes limpos');

    console.log('\n--- LIMPEZA CONCLUÍDA ---');
  } catch (error) {
    console.error('Erro fatal:', error);
  }
}

clearDatabase();
