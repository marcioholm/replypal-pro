import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
  console.log("Deletando todas as mensagens...");
  const { error: msgErr } = await supabase.from('mensagens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (msgErr) console.error("Erro mensagens:", msgErr);
  else console.log("Mensagens apagadas com sucesso.");

  console.log("Deletando todas as conversas...");
  const { error: convErr } = await supabase.from('conversas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (convErr) console.error("Erro conversas:", convErr);
  else console.log("Conversas apagadas com sucesso.");
}

wipe();
