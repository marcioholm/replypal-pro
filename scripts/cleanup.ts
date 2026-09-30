import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log('--- LIMPANDO BANCO DE DADOS (DADOS DE TESTE) ---');
  
  try {
    const { error: err1 } = await supabase.from('mensagens').delete().neq('content', '___DELETE_ALL___');
    if (err1) console.error('Erro ao limpar mensagens:', err1.message);
    else console.log('✅ Mensagens limpas');

    const { error: err2 } = await supabase.from('historico').delete().neq('action', '___DELETE_ALL___');
    if (err2) console.error('Erro ao limpar historico:', err2.message);
    else console.log('✅ Histórico limpo');

    const { error: err3 } = await supabase.from('documentos').delete().neq('categoria', '___DELETE_ALL___');
    if (err3) console.error('Erro ao limpar documentos:', err3.message);
    else console.log('✅ Documentos limpos');

    const { error: err4 } = await supabase.from('conversas').delete().neq('status', '___DELETE_ALL___');
    if (err4) console.error('Erro ao limpar conversas:', err4.message);
    else console.log('✅ Conversas limpas');

    const { error: err5 } = await supabase.from('tags').delete().neq('nome', '___DELETE_ALL___');
    if (err5) console.error('Erro ao limpar tags:', err5.message);
    else console.log('✅ Tags limpas');

    const { error: err6 } = await supabase.from('clientes').delete().neq('nome_fantasia', '___DELETE_ALL___');
    if (err6) console.error('Erro ao limpar clientes:', err6.message);
    else console.log('✅ Clientes limpos');

    console.log('\n--- BANCO PRONTO PARA PRODUÇÃO ---');
  } catch (error) {
    console.error('Erro fatal:', error);
  }
}

clearDatabase();
