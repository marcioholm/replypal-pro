import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function createSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const payload = req.body;
  const event = payload.event;
  const data = payload.data;

  if (!event || !data) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const supabase = await createSupabaseClient();

    if (event === 'messages.upsert') {
      const msg = data.message || data;
      const key = msg.key;
      const messageContent = msg.message;
      
      if (!key || !messageContent) return res.status(200).json({ success: true, message: 'No content' });

      const remoteJid = key.remoteJid;
      const phone = remoteJid.split('@')[0];
      const isFromMe = key.fromMe;
      
      // Encontrar ou criar conversa
      let { data: conv, error: convError } = await supabase
        .from('conversas')
        .select('id, tenant_id')
        .eq('client_phone', phone)
        .maybeSingle();

      if (!conv) {
        // Criar nova conversa se não existir
        const { data: newConv, error: createError } = await supabase
          .from('conversas')
          .insert({
            client_name: phone,
            client_phone: phone,
            status: 'novo',
            last_message_time: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) throw createError;
        conv = newConv;
      }

      // Processar conteúdo
      let type = 'text';
      let content = '';
      let mediaUrl = null;
      let mimeType = null;
      let fileName = null;
      let fileSize = null;
      let duration = null;

      if (messageContent.conversation || messageContent.extendedTextMessage) {
        type = 'text';
        content = messageContent.conversation || messageContent.extendedTextMessage.text;
      } else if (messageContent.imageMessage) {
        type = 'image';
        content = messageContent.imageMessage.caption || '[Imagem]';
        mediaUrl = messageContent.imageMessage.url; // Nota: Evolution API URL
        mimeType = messageContent.imageMessage.mimetype;
        fileSize = messageContent.imageMessage.fileLength;
      } else if (messageContent.videoMessage) {
        type = 'video';
        content = messageContent.videoMessage.caption || '[Vídeo]';
        mediaUrl = messageContent.videoMessage.url;
        mimeType = messageContent.videoMessage.mimetype;
        fileSize = messageContent.videoMessage.fileLength;
        duration = messageContent.videoMessage.seconds;
      } else if (messageContent.audioMessage) {
        type = 'audio';
        content = '[Áudio]';
        mediaUrl = messageContent.audioMessage.url;
        mimeType = messageContent.audioMessage.mimetype;
        fileSize = messageContent.audioMessage.fileLength;
        duration = messageContent.audioMessage.seconds;
      } else if (messageContent.documentMessage) {
        type = 'document';
        content = messageContent.documentMessage.title || '[Documento]';
        mediaUrl = messageContent.documentMessage.url;
        mimeType = messageContent.documentMessage.mimetype;
        fileSize = messageContent.documentMessage.fileLength;
        fileName = messageContent.documentMessage.fileName || messageContent.documentMessage.title;
      }

      // Salvar mensagem (usar upsert para evitar duplicatas se o front já inseriu)
      const { error: msgError } = await supabase
        .from('mensagens')
        .upsert({
          conversation_id: conv.id,
          content: content,
          sender: isFromMe ? 'agent' : 'client',
          sender_name: isFromMe ? 'WhatsApp' : phone,
          type: type,
          media_url: mediaUrl,
          mime_type: mimeType,
          file_name: fileName,
          file_size: fileSize,
          duration_seconds: duration,
          external_message_id: key.id,
          status: isFromMe ? 'sent' : 'delivered',
          tenant_id: conv.tenant_id
        }, { onConflict: 'external_message_id' });

      if (msgError) throw msgError;

      // Atualizar última mensagem da conversa
      await supabase
        .from('conversas')
        .update({
          last_message: content,
          last_message_time: new Date().toISOString()
        })
        .eq('id', conv.id);

    } else if (event === 'messages.update') {
      // Atualizar status da mensagem (entregue, lida)
      const statusUpdate = data[0] || data;
      const key = statusUpdate.key;
      const status = statusUpdate.status;

      if (key && status) {
        let dbStatus = 'sent';
        if (status === 3 || status === 'DELIVERY_ACK') dbStatus = 'delivered';
        if (status === 4 || status === 'READ') dbStatus = 'read';
        if (status === 5 || status === 'PLAYED') dbStatus = 'read';

        await supabase
          .from('mensagens')
          .update({ 
            status: dbStatus,
            delivered_at: dbStatus === 'delivered' ? new Date().toISOString() : undefined,
            read_at: dbStatus === 'read' ? new Date().toISOString() : undefined
          })
          .eq('external_message_id', key.id);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: String(error) });
  }
}
