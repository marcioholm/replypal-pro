import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function createSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseKey);
}

async function downloadAndUploadMedia(supabase: any, evolutionUrl: string, apikey: string, mediaPath: string, fileName: string, mimeType: string) {
  try {
    // Se a URL já for pública (contém http), tentar usar ela, senão construir a URL da Evolution
    const downloadUrl = mediaPath.startsWith('http') ? mediaPath : `${evolutionUrl}/public/${mediaPath}`;
    
    console.log(`Webhook: Downloading media from ${downloadUrl}`);
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(downloadUrl, {
      headers: { "apikey": apikey }
    });

    if (!response.ok) {
      console.error(`Webhook: Failed to download media: ${response.statusText}`);
      return mediaPath; // Fallback para a URL original
    }

    const buffer = await response.buffer();
    const storagePath = `incoming/${Date.now()}_${fileName}`;

    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Webhook: Supabase upload error:', error);
      return mediaPath;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (err) {
    console.error('Webhook: Media proxy error:', err);
    return mediaPath;
  }
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
      const key = msg.key || data.key;
      const messageContent = msg.message || data.message;
      
      if (!key || !messageContent) {
        console.log('Webhook: No key or messageContent found', { key: !!key, content: !!messageContent });
        return res.status(200).json({ success: true, message: 'No content' });
      }

      const remoteJid = key.remoteJid;
      if (!remoteJid) return res.status(200).json({ success: true, message: 'No remoteJid' });
      
      const phone = remoteJid.split('@')[0];
      const isFromMe = key.fromMe;
      
      // Default Tenant ID (from dbSetup.ts)
      const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';

      // Encontrar ou criar conversa
      let { data: conv, error: convError } = await supabase
        .from('conversas')
        .select('id, tenant_id')
        .eq('client_phone', phone)
        .maybeSingle();

      if (!conv) {
        // Tentar encontrar o tenant do primeiro usuário ou usar default
        const { data: firstUser } = await supabase.from('usuarios').select('tenant_id').limit(1).single();
        const tenantToUse = firstUser?.tenant_id || DEFAULT_TENANT_ID;

        // Criar nova conversa se não existir
        const { data: newConv, error: createError } = await supabase
          .from('conversas')
          .insert({
            client_name: phone,
            client_phone: phone,
            status: 'novo',
            last_message_time: new Date().toISOString(),
            tenant_id: tenantToUse
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Webhook: Error creating conversation:', createError);
          throw createError;
        }
        conv = newConv;
      }

      const tenantId = conv.tenant_id || DEFAULT_TENANT_ID;

      // Processar conteúdo
      let type = 'text';
      let content = '';
      let mediaUrl = null;
      let mimeType = null;
      let fileName = null;
      let fileSize = null;
      let duration = null;

      console.log('Webhook: Processing message content keys:', Object.keys(messageContent));

      // Suporte para mensagens de texto simples ou estendido
      if (messageContent.conversation || messageContent.extendedTextMessage) {
        type = 'text';
        content = messageContent.conversation || messageContent.extendedTextMessage.text;
      } 
      // Evolution API settings for media download
      const evolutionUrl = process.env.VITE_EVOLUTION_URL || "";
      const evolutionKey = process.env.VITE_EVOLUTION_API_KEY || "";

      // Suporte para mídias (Imagem, Vídeo, Áudio, Documento)
      else if (messageContent.imageMessage) {
        type = 'image';
        content = messageContent.imageMessage.caption || '[Imagem]';
        mimeType = messageContent.imageMessage.mimetype;
        fileSize = messageContent.imageMessage.fileLength;
        const originalPath = messageContent.imageMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, evolutionUrl, evolutionKey, originalPath, 'image.jpg', mimeType);
        console.log('Webhook: Image processed', { mediaUrl });
      } else if (messageContent.videoMessage) {
        type = 'video';
        content = messageContent.videoMessage.caption || '[Vídeo]';
        mimeType = messageContent.videoMessage.mimetype;
        fileSize = messageContent.videoMessage.fileLength;
        duration = messageContent.videoMessage.seconds;
        const originalPath = messageContent.videoMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, evolutionUrl, evolutionKey, originalPath, 'video.mp4', mimeType);
      } else if (messageContent.audioMessage) {
        type = 'audio';
        content = '[Áudio]';
        mimeType = messageContent.audioMessage.mimetype;
        fileSize = messageContent.audioMessage.fileLength;
        duration = messageContent.audioMessage.seconds;
        const originalPath = messageContent.audioMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, evolutionUrl, evolutionKey, originalPath, 'audio.ogg', mimeType);
      } else if (messageContent.documentMessage) {
        type = 'document';
        content = messageContent.documentMessage.title || '[Documento]';
        mimeType = messageContent.documentMessage.mimetype;
        fileSize = messageContent.documentMessage.fileLength;
        fileName = messageContent.documentMessage.fileName || messageContent.documentMessage.title;
        const originalPath = messageContent.documentMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, evolutionUrl, evolutionKey, originalPath, fileName, mimeType);
      } else {
        // Caso seja algum tipo não tratado explicitamente
        console.log('Webhook: Unhandled message type:', Object.keys(messageContent));
        return res.status(200).json({ success: true, message: 'Unhandled type' });
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
          tenant_id: tenantId
        }, { onConflict: 'external_message_id' });

      if (msgError) throw msgError;

      // Atualizar última mensagem da conversa
      await supabase
        .from('conversas')
        .update({
          last_message: content,
          last_message_time: new Date().toISOString(),
          tenant_id: tenantId
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
