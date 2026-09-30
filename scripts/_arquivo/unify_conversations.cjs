const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function unifyConversations() {
  console.log('--- Iniciando Unificação de Conversas (Data Hygiene) ---');

  // 1. Buscar todas as conversas
  const { data: convs, error } = await supabase.from('conversas').select('*');
  if (error) {
    console.error('Erro ao buscar conversas:', error);
    return;
  }

  console.log(`Analisando ${convs.length} conversas...`);

  const phoneMap = new Map();

  for (const conv of convs) {
    let phone = conv.client_phone;
    // Normalizar para 55 + DDD + Número
    if (phone && !phone.startsWith('55') && phone.length >= 10 && !phone.includes('@')) {
      phone = '55' + phone;
    }

    if (!phone) continue;

    if (!phoneMap.has(phone)) {
      phoneMap.set(phone, []);
    }
    phoneMap.get(phone).push(conv);
  }

  for (const [phone, list] of phoneMap.entries()) {
    // Se tiver mais de uma conversa para o mesmo telefone normalizado
    if (list.length > 1 || list[0].client_phone !== phone) {
      console.log(`Unificando telefone: ${phone} (${list.length} registros found)`);

      // Eleger a conversa "mestra" (a que tem nome mais completo ou ID mais baixo)
      const master = list.sort((a, b) => (a.client_name?.length || 0) < (b.client_name?.length || 0) ? 1 : -1)[0];
      const duplicates = list.filter(c => c.id !== master.id);

      // 2. Corrigir o telefone da mestra se necessário
      if (master.client_phone !== phone) {
        await supabase.from('conversas').update({ client_phone: phone }).eq('id', master.id);
      }

      // 3. Mover mensagens das duplicatas para a mestra
      for (const dup of duplicates) {
        console.log(`  -> Movendo mensagens de ${dup.id} para ${master.id}`);
        const { error: msgError } = await supabase
          .from('mensagens')
          .update({ conversation_id: master.id })
          .eq('conversation_id', dup.id);
        
        if (!msgError) {
          // 4. Deletar a duplicata
          await supabase.from('conversas').delete().eq('id', dup.id);
        } else {
          console.error(`Erro ao mover mensagens:`, msgError);
        }
      }
    }
  }

  console.log('--- Unificação Concluída! ---');
}

unifyConversations();
