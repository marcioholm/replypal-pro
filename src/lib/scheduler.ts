import { supabase } from "./supabase";
import { sendWhatsAppMessage, sendMediaMessage } from "./evolution";

export async function processScheduledMessages() {
  const now = new Date().toISOString();
  
  // Buscar mensagens agendadas para agora ou antes que ainda não foram enviadas
  const { data, error } = await supabase
    .from('mensagens_agendadas')
    .select('*')
    .eq('status', 'agendada')
    .lte('scheduled_at', now);

  if (error || !data || data.length === 0) return;

  for (const msg of data) {
    try {
      console.log(`Processando mensagem agendada: ${msg.id} para ${msg.receiver_number}`);
      let result;
      
      if (msg.message_type === 'text') {
        result = await sendWhatsAppMessage(msg.receiver_number, msg.text_content);
      } else {
        result = await sendMediaMessage(
          msg.receiver_number, 
          msg.media_url, 
          msg.message_type as any, 
          msg.file_name, 
          msg.text_content
        );
      }

      if (result.success) {
        // Atualizar no banco como enviada
        await supabase
          .from('mensagens_agendadas')
          .update({ 
            status: 'enviada', 
            sent_at: new Date().toISOString() 
          })
          .eq('id', msg.id);
          
        // Se for uma conversa ativa, adicionar a mensagem na tabela de mensagens também
        if (msg.conversa_id) {
          await supabase.from('mensagens').insert({
            conversation_id: msg.conversa_id,
            content: msg.text_content || `[Arquivo: ${msg.file_name}]`,
            sender: 'agent',
            type: msg.message_type,
            media_url: msg.media_url,
            mime_type: msg.mime_type,
            tenant_id: msg.tenant_id
          });

          // Atualizar última mensagem da conversa
          await supabase.from('conversas').update({
            last_message: msg.text_content || `[Arquivo: ${msg.file_name}]`,
            last_message_time: new Date().toISOString(),
            status: 'aguardando_cliente'
          }).eq('id', msg.conversa_id);
        }
      } else {
        // Marcar como erro
        await supabase
          .from('mensagens_agendadas')
          .update({ 
            status: 'erro', 
            error_message: result.error || "Erro desconhecido ao enviar" 
          })
          .eq('id', msg.id);
      }
    } catch (err) {
      console.error(`Erro ao processar mensagem agendada ${msg.id}:`, err);
    }
  }
}

let schedulerInterval: any = null;

export function startScheduler() {
  if (schedulerInterval) return;
  
  console.log("Iniciando scheduler de mensagens agendadas...");
  // Executar imediatamente e depois a cada minuto
  processScheduledMessages();
  schedulerInterval = setInterval(processScheduledMessages, 60000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("Scheduler de mensagens agendadas parado.");
  }
}
