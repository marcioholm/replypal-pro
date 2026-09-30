import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConversation() {
  const convId = '16a04f03-9e28-4b01-aea8-e248fa9a96c0';
  const { data: conv, error } = await supabase
    .from('conversas')
    .select('*')
    .eq('id', convId)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  console.log('Conversa:', conv);
}

checkConversation();
