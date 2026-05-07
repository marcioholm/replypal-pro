import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function createSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseKey);
}

async function downloadAndUploadMedia(
  supabase: any,
  evolutionUrl: string,
  apikey: string,
  mediaPath: string,
  fileName: string,
  mimeType: string,
  fullMessage?: any
): Promise<string> {
  const evoUrl = (process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || evolutionUrl || "").replace(/\/$/, "");
  const evoKey = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTION_API_KEY || apikey || "";
  const instance = process.env.INSTANCE_NAME || process.env.VITE_INSTANCE_NAME || "SASAKI";

  console.log(`Webhook Media: Processing ${fileName} (${mimeType}). Path: ${mediaPath}`);
  console.log(`Webhook Media: evoUrl: ${evoUrl}, instance: ${instance}`);

  try {
    let buffer: Buffer | null = null;

    // Estratégia 1: endpoint base64 da Evolution (mais confiável)
    if (fullMessage) {
      try {
        console.log(`Webhook Media: Trying Strategy 1 (Base64)`);
        const base64Res = await fetch(`${evoUrl}/message/getBase64FromMediaMessage/${instance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evoKey },
          body: JSON.stringify({ message: fullMessage, convertToMp4: false }),
        });
        
        if (base64Res.ok) {
          const json = await base64Res.json();
          if (json.base64) {
            console.log(`Webhook Media: Strategy 1 success!`);
            buffer = Buffer.from(json.base64, 'base64');
          } else {
            console.log(`Webhook Media: Strategy 1 returned no base64`);
          }
        } else {
          const errText = await base64Res.text();
          console.log(`Webhook Media: Strategy 1 failed with status ${base64Res.status}: ${errText}`);
        }
      } catch (err) {
        console.log(`Webhook Media: Strategy 1 error: ${String(err)}`);
      }
    }

    // Estratégia 2: download direto da URL com autenticação
    if (!buffer) {
      try {
        const downloadUrl = mediaPath.startsWith("http")
          ? mediaPath
          : `${evoUrl}/public/${mediaPath}`; // Adicionado /public/ que é comum na Evolution

        console.log(`Webhook Media: Trying Strategy 2 (Download) from ${downloadUrl}`);

        const response = await fetch(downloadUrl, {
          headers: { "apikey": evoKey },
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          if (buffer.length < 100) {
            console.log(`Webhook Media: Strategy 2 returned suspiciously small buffer (${buffer.length} bytes)`);
            buffer = null;
          } else {
            console.log(`Webhook Media: Strategy 2 success! (${buffer.length} bytes)`);
          }
        } else {
          console.log(`Webhook Media: Strategy 2 failed with status ${response.status}`);
        }
      } catch (err) {
        console.log(`Webhook Media: Strategy 2 error: ${String(err)}`);
      }
    }

    if (!buffer) {
      console.error(`Webhook Media: All download strategies failed for ${mediaPath}`);
      return mediaPath;
    }

    const safeFileName = (fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `incoming/${Date.now()}_${safeFileName}`;

    console.log(`Webhook Media: Uploading to Supabase bucket 'chat-media' at ${storagePath}`);
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(storagePath, buffer, { 
        contentType: mimeType || "application/octet-stream", 
        upsert: true 
      });

    if (error) {
      console.error("Webhook Media: Supabase upload error:", error.message);
      return mediaPath;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("chat-media")
      .getPublicUrl(storagePath);

    console.log(`Webhook Media: Success! Public URL: ${publicUrl}`);
    return publicUrl;

  } catch (err) {
    console.error("Webhook Media: Unexpected error:", String(err));
    return mediaPath;
  }
}



export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { event, data } = req.body;
  if (!event || !data) return res.status(400).json({ error: 'Invalid payload' });

  try {
    const supabase = await createSupabaseClient();

    if (event === 'messages.upsert') {
      const msg = data.message || data;
      const key = msg.key || data.key;
      const messageContent = msg.message || data.message;
      const pushName = data.pushName || msg.pushName || '';
      
      if (!key || !messageContent) {
        console.log('Webhook: No key or messageContent found');
        return res.status(200).json({ success: true, message: 'No content' });
      }

      const remoteJid = key.remoteJid;
      if (!remoteJid) return res.status(200).json({ success: true, message: 'No remoteJid' });
      
      const phone = remoteJid.split('@')[0];
      const isFromMe = key.fromMe;

      // Ignorar mensagens enviadas pelo próprio sistema (fromMe)
      // O frontend já as insere diretamente no banco
      if (isFromMe) {
        return res.status(200).json({ success: true, message: 'Outgoing message ignored' });
      }
      const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';

      // Encontrar ou criar conversa - IMPLEMENTAÇÃO 1.1: Tenant lookup robusto
      let { data: conv, error: convError } = await supabase
        .from('conversas')
        .select('id, tenant_id')
        .eq('client_phone', phone)
        .maybeSingle();

      if (!conv) {
        // Buscar tenant pela instância configurada em Settings
        const instanceName = req.headers['x-instance-name'] as string || process.env.VITE_INSTANCE_NAME || '';
        
        let tenantToUse = DEFAULT_TENANT_ID;
        
        if (instanceName) {
          const { data: tenantConfig } = await supabase
            .from('tenants')
            .select('id')
            .eq('evolution_instance', instanceName)
            .maybeSingle();
          
          if (tenantConfig) {
            tenantToUse = tenantConfig.id;
          } else {
            // Fallback: primeiro usuário ativo
            const { data: firstUser } = await supabase
              .from('usuarios')
              .select('tenant_id')
              .eq('ativo', true)
              .order('created_at', { ascending: true })
              .limit(1)
              .single();
            tenantToUse = firstUser?.tenant_id || DEFAULT_TENANT_ID;
          }
        }

        const { data: newConv, error: createError } = await supabase
          .from('conversas')
          .insert({
            client_name: pushName || phone,
            client_phone: phone,
            status: 'novo',
            last_message_time: new Date().toISOString(),
            tenant_id: tenantToUse
            // NÃO setar assigned_to — deixar null para aparecer em "Pendentes"
          })
          .select()
          .single();
        
        if (createError) throw createError;
        conv = newConv;
      } else if (pushName) {
        // Atualizar nome se mudou
        await supabase.from('conversas').update({ client_name: pushName }).eq('id', conv.id);
      }

      const tenantId = conv.tenant_id || DEFAULT_TENANT_ID;

      // Processar conteúdo
      let type = 'text';
      let content = '';
      let mediaUrl: string | null = null;
      let mimeType: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let duration: number | null = null;

      // Verificar texto em vários campos possíveis
      const text = messageContent.conversation || 
                   messageContent.extendedTextMessage?.text || 
                   messageContent.text || 
                   messageContent.body || 
                   '';

      if (text) {
        type = 'text';
        content = text;
      } else if (messageContent.imageMessage) {
        type = 'image';
        content = messageContent.imageMessage.caption || '[Imagem]';
        mimeType = messageContent.imageMessage.mimetype;
        fileSize = messageContent.imageMessage.fileLength;
        const originalPath = messageContent.imageMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, "", "", originalPath, 'image.jpg', mimeType, msg);
      } else if (messageContent.videoMessage) {
        type = 'video';
        content = messageContent.videoMessage.caption || '[Vídeo]';
        mimeType = messageContent.videoMessage.mimetype;
        fileSize = messageContent.videoMessage.fileLength;
        duration = messageContent.videoMessage.seconds;
        const originalPath = messageContent.videoMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, "", "", originalPath, 'video.mp4', mimeType, msg);
      } else if (messageContent.audioMessage) {
        type = 'audio';
        content = '[Áudio]';
        mimeType = messageContent.audioMessage.mimetype;
        fileSize = messageContent.audioMessage.fileLength;
        duration = messageContent.audioMessage.seconds;
        const originalPath = messageContent.audioMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, "", "", originalPath, 'audio.ogg', mimeType, msg);
      } else if (messageContent.documentMessage) {
        type = 'document';
        content = messageContent.documentMessage.title || '[Documento]';
        mimeType = messageContent.documentMessage.mimetype;
        fileSize = messageContent.documentMessage.fileLength;
        fileName = messageContent.documentMessage.fileName || messageContent.documentMessage.title;
        const originalPath = messageContent.documentMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, "", "", originalPath, fileName || 'document', mimeType, msg);
      } else if (messageContent.stickerMessage) {
        // IMPLEMENTAÇÃO 5: Sticker
        type = 'sticker';
        content = '[Sticker]';
        mimeType = messageContent.stickerMessage.mimetype || 'image/webp';
        const originalPath = messageContent.stickerMessage.url;
        mediaUrl = await downloadAndUploadMedia(supabase, "", "", originalPath, 'sticker.webp', 'image/webp', msg);
      } else if (messageContent.reactionMessage) {
        // IMPLEMENTAÇÃO 5: Reaction
        const reactionKey = messageContent.reactionMessage.key;
        const reactionText = messageContent.reactionMessage.text;
        if (reactionKey?.id) {
          await supabase.from('mensagens').update({ reaction: reactionText || '' })
            .eq('external_message_id', reactionKey.id);
        }
        return res.status(200).json({ success: true, message: 'Reaction processed' });
      } else if (messageContent.locationMessage) {
        // IMPLEMENTAÇÃO 5: Location
        type = 'location';
        const loc = messageContent.locationMessage;
        content = loc.name || `${loc.degreesLatitude},${loc.degreesLongitude}`;
        mediaUrl = `https://www.google.com/maps?q=${loc.degreesLatitude},${loc.degreesLongitude}`;
        fileName = loc.name || 'Localização';
      } else if (messageContent.contactMessage || messageContent.contactsArrayMessage) {
        // IMPLEMENTAÇÃO 5: Contact
        type = 'contact';
        const contacts = messageContent.contactsArrayMessage?.contacts || [messageContent.contactMessage];
        content = contacts.map((c: any) => c?.displayName || c?.vcard?.split('FN:')[1]?.split('\n')[0] || 'Contato').join(', ');
        fileName = content;
      } else if (messageContent.documentWithCaptionMessage) {
        // IMPLEMENTAÇÃO 5: Document with caption
        const docMsg = messageContent.documentWithCaptionMessage.message?.documentMessage;
        if (docMsg) {
          type = 'document';
          content = docMsg.title || docMsg.fileName || '[Documento]';
          mimeType = docMsg.mimetype;
          fileSize = docMsg.fileLength;
          fileName = docMsg.fileName || docMsg.title;
          mediaUrl = await downloadAndUploadMedia(supabase, "", "", docMsg.url, fileName || 'document', mimeType || 'application/octet-stream', msg);
        }
      } else if (messageContent.pollCreationMessage || messageContent.pollCreationMessageV2 || messageContent.pollCreationMessageV3) {
        // IMPLEMENTAÇÃO 5: Poll
        const poll = messageContent.pollCreationMessage || messageContent.pollCreationMessageV2 || messageContent.pollCreationMessageV3;
        type = 'text';
        const opts = (poll.options || []).map((o: any) => `• ${o.optionName}`).join('\n');
        content = `📊 *${poll.name}*\n${opts}`;
      } else if (messageContent.ephemeralMessage) {
        type = 'text';
        content = '[Mensagem temporária]';
      } else if (messageContent.templateMessage) {
        type = 'text';
        content = messageContent.templateMessage?.hydratedTemplate?.hydratedContentText || '[Template]';
      } else {
        console.log('Webhook: Unhandled type', Object.keys(messageContent));
        return res.status(200).json({ success: true, message: 'Unhandled type' });
      }

      // Salvar mensagem
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
      // IMPLEMENTAÇÃO 5: messages.update com suporte a array e status como string ou número
      const updates = Array.isArray(data) ? data : [data];
      
      for (const statusUpdate of updates) {
        const key = statusUpdate.key || statusUpdate.update?.key;
        const status = statusUpdate.update?.status || statusUpdate.status;
        
        if (!key?.id || status === undefined) continue;
        
        let dbStatus = 'sent';
        if (status === 'DELIVERY_ACK' || status === 3) dbStatus = 'delivered';
        if (status === 'READ' || status === 4) dbStatus = 'read';
        if (status === 'PLAYED' || status === 5) dbStatus = 'read';
        if (status === 'ERROR' || status === 0) dbStatus = 'error';
        
        const updateData: Record<string, any> = { status: dbStatus };
        if (dbStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
        if (dbStatus === 'read') updateData.read_at = new Date().toISOString();
        
        await supabase.from('mensagens')
          .update(updateData)
          .eq('external_message_id', key.id);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: String(error) });
  }
}