import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const convId = '16a04f03-9e28-4b01-aea8-e248fa9a96c0';
  const { data, error } = await supabase.from('mensagens').insert({
    conversation_id: convId,
    content: '[TESTE] Contato',
    sender: 'client',
    sender_name: 'Teste',
    type: 'contact',
    external_message_id: 'test-' + Date.now()
  }).select();

  if (error) console.error('Error:', error);
  else console.log('Success:', data);
}

testInsert();
