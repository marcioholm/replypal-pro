// VERSION: 2026-05-07 12:12 - 413 PAYLOAD FIX & DOWNLOAD OPTIMIZATION
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadAndUploadMedia(evolutionUrl: string, apikey: string, mediaPath: string, fileName: string, mimeType: string, fullMessage: any, tenantId?: string): Promise<{ url: string, error?: string }> {
  const evoUrl = (process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || evolutionUrl || "").replace(/\/$/, "");
  const evoKey = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTION_API_KEY || apikey || "";
  const instance = fullMessage?.instance || process.env.INSTANCE_NAME || "SASAKI";
  let diagError = "";

  try {
    let buffer: Buffer | null = null;

    const findBase64 = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.base64 && typeof obj.base64 === 'string' && obj.base64.length > 100) return obj.base64;
      const commonKeys = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage', 'message'];
      for (const key of commonKeys) {
        if (obj[key]) {
          const res = findBase64(obj[key]);
          if (res) return res;
        }
      }
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          const result = findBase64(obj[key]);
          if (result) return result;
        }
      }
      return null;
    };

    const b64 = findBase64(fullMessage);
    if (b64) {
      const clean = b64.includes('base64,') ? b64.split('base64,')[1] : b64;
      buffer = Buffer.from(clean, 'base64');
    }

    if (!buffer && mediaPath.startsWith("http")) {
      try {
        const response = await fetch(mediaPath);
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && (contentType.includes('image') || contentType.includes('audio') || contentType.includes('video') || contentType.includes('application/pdf'))) {
            buffer = Buffer.from(await response.arrayBuffer());
            console.log(`[Webhook] Mídia baixada diretamente do CDN WhatsApp (${buffer.length} bytes)`);
          }
        }
      } catch (e) {
        console.error("[Webhook] Erro no download direto:", e);
      }
    }

    if (!buffer && evoUrl && evoKey) {
      const instName = fullMessage?.instance || fullMessage?.data?.instance || instance;
      const msgId = fullMessage?.key?.id || fullMessage?.data?.key?.id || fullMessage?.message?.key?.id;
      const instId = fullMessage?.instanceId || fullMessage?.data?.instanceId;
      
      if (msgId) {
        const encName = encodeURIComponent(instName);
        const downloadEndpoints = [
          `${evoUrl}/chat/getBase64FromMediaMessage/${encName}`,
          `${evoUrl}/message/convert/toBase64/${encName}`
        ];
        if (instId) {
          downloadEndpoints.push(`${evoUrl}/chat/getBase64FromMediaMessage/${instId}`);
          downloadEndpoints.push(`${evoUrl}/message/convert/toBase64/${instId}`);
        }

        for (const url of downloadEndpoints) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
              body: JSON.stringify(fullMessage.data || fullMessage)
            });
            
            if (response.ok) {
              const json = await response.json() as any;
              const b64Data = json?.base64 || json?.data?.base64;
              if (b64Data) {
                buffer = Buffer.from(b64Data.includes('base64,') ? b64Data.split('base64,')[1] : b64Data, 'base64');
                break;
              }
            } else {
              const txt = await response.text();
              diagError = `Evo ${response.status}: ${txt.substring(0, 30)}`;
            }
          } catch (e: any) {
            diagError = `Conn error: ${e.message}`;
          }
        }
      }
    }

    if (!buffer || buffer.length < 100) {
      return { 
        url: mediaPath.startsWith("http") ? mediaPath : `${evoUrl}/public/${mediaPath}`,
        error: diagError || "Download failed"
      };
    }

    const tDir = tenantId || "shared";
    const storagePath = `${tDir}/${Date.now()}_${(fileName || "file").replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { error } = await supabase.storage.from("chat-media").upload(storagePath, buffer, { 
      contentType: mimeType || "application/octet-stream", 
      upsert: true 
    });

    if (error) return { url: mediaPath, error: `Upload err: ${error.message}` };

    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(storagePath);
    return { url: publicUrl };
  } catch (err: any) {
    return { url: mediaPath, error: `Critical: ${err.message}` };
  }
}

function toNum(val: any) {
  if (typeof val === 'object' && val !== null) return val.low || 0;
  return typeof val === 'number' ? val : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'online',
      diagnostico: {
        url_configurada: !!process.env.EVOLUTION_URL,
        key_configurada: !!process.env.EVOLUTION_API_KEY,
        url_inicial: (process.env.EVOLUTION_URL || "").substring(0, 20) + "..."
      }
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { event, data, instance: instPayload } = req.body || {};
  if (!event || !data) return res.status(400).json({ error: 'Invalid payload' });

  try {
    const evoUrl = (process.env.EVOLUTION_URL || "").replace(/\/$/, "");
    const evoKey = process.env.EVOLUTION_API_KEY || "";

    // Normalizar o evento para suportar diferentes versões da Evolution API
    const normalizedEvent = event.toLowerCase().replace(/_/g, '.');

    if (normalizedEvent === 'messages.upsert') {
      const msg = data.message || data;
      const key = msg.key || data.key;
      const messageContent = msg.message || data.message;
      const pushName = data.pushName || msg.pushName || '';
      const remoteJid = key?.remoteJid;
      if (!remoteJid) return res.status(200).json({ success: true });

      const isGroup = remoteJid.endsWith('@g.us');
      const phone = isGroup ? remoteJid : remoteJid.split('@')[0];
      const isFromMe = !!key?.fromMe;
      
      const DEFAULT_TENANT = '11111111-1111-1111-1111-111111111111';
      // Capturar avatar do cliente de várias fontes possíveis (v1, v2 e data wrapper)
      const profilePic = data.profilePicUrl || 
                        messageContent?.profilePicUrl || 
                        data.data?.profilePicUrl || 
                        data.sender?.profilePicUrl;

      // 1. Verificar se o número pertence a um cliente cadastrado
      const searchPhones = [phone];
      if (phone.startsWith('55')) searchPhones.push(phone.substring(2));
      else searchPhones.push('55' + phone);

      console.log(`[Webhook] Buscando cliente para: ${phone} (Variações: ${searchPhones.join(', ')})`);

      const { data: matchedCustomer } = await supabase
        .from('clientes')
        .select('id, nome_fantasia, responsavel')
        .or(`whatsapp.in.(${searchPhones.join(',')}),telefone.in.(${searchPhones.join(',')})`)
        .maybeSingle();

      if (matchedCustomer) {
        console.log(`[Webhook] Cliente encontrado: ${matchedCustomer.responsavel || matchedCustomer.nome_fantasia}`);
      } else {
        console.log(`[Webhook] Nenhum cliente encontrado para ${phone}`);
      }

      // 2. Garantir que a conversa existe
      let { data: conv } = await supabase.from('conversas').select('*').eq('client_phone', phone).maybeSingle();

      if (!conv) {
        const instName = instPayload || req.headers['x-instance-name'] as string || "";
        let tId = DEFAULT_TENANT;
        if (instName) {
          const { data: tCfg } = await supabase.from('tenants').select('id').eq('evolution_instance', instName).maybeSingle();
          if (tCfg) tId = tCfg.id;
        }
        const now = new Date();
        const slaDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 horas de SLA por padrão

        const { data: nConv, error: cErr } = await supabase.from('conversas').upsert({
          client_name: matchedCustomer?.responsavel || matchedCustomer?.nome_fantasia || (isFromMe ? phone : (pushName || phone)), 
          client_phone: phone, 
          customer_id: matchedCustomer?.id || null,
          status: isFromMe ? 'em_atendimento' : 'novo', 
          last_message_time: now.toISOString(), 
          tenant_id: tId,
          client_avatar: profilePic, 
          is_group: isGroup,
          sla_deadline: slaDeadline.toISOString()
        }, { onConflict: 'client_phone,tenant_id' }).select().single();
        if (cErr) throw cErr;
        conv = nConv;
      } else if (profilePic && conv.client_avatar !== profilePic) {
        // Atualizar avatar se mudou
        await supabase.from('conversas').update({ client_avatar: profilePic }).eq('id', conv.id);
      }

      const tenantId = conv?.tenant_id || DEFAULT_TENANT;

      // Verificar se mensagem já existe (evitar duplicar envios manuais do chat)
      if (isFromMe) {
        const { data: existingMsg } = await supabase
          .from('mensagens')
          .select('id')
          .eq('external_message_id', key.id)
          .maybeSingle();
        
        if (existingMsg) return res.status(200).json({ success: true, detail: 'Manual message already recorded' });
      }

      let type = 'text', content = '', mediaUrl = null, mimeType = null, fileName = null, fileSize = null, duration = null;

      const text = messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.text || '';
      if (text) {
        content = text;
      } else if (messageContent.imageMessage) {
        type = 'image'; content = messageContent.imageMessage.caption || '';
        mimeType = messageContent.imageMessage.mimetype;
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.imageMessage.url, 'image.jpg', mimeType, req.body, tenantId);
        mediaUrl = res.url; if (res.error) content = `[DEBUG] ${res.error}`;
      } else if (messageContent.videoMessage) {
        type = 'video'; content = messageContent.videoMessage.caption || '';
        mimeType = messageContent.videoMessage.mimetype;
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.videoMessage.url, 'video.mp4', mimeType, req.body, tenantId);
        mediaUrl = res.url; if (res.error) content = `[DEBUG] ${res.error}`;
      } else if (messageContent.audioMessage) {
        type = 'audio'; content = '';
        mimeType = 'audio/ogg'; 
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.audioMessage.url, 'audio.ogg', mimeType, req.body, tenantId);
        mediaUrl = res.url; if (res.error) content = `[DEBUG] ${res.error}`;
      } else if (messageContent.documentMessage || messageContent.documentWithCaptionMessage) {
        const doc = messageContent.documentMessage || messageContent.documentWithCaptionMessage?.message?.documentMessage;
        if (doc) {
          type = 'document'; fileName = doc.fileName || 'document';
          content = doc.caption || fileName; mimeType = doc.mimetype;
          const res = await downloadAndUploadMedia(evoUrl, evoKey, doc.url, fileName, mimeType, req.body, tenantId);
          mediaUrl = res.url; if (res.error) content = `[DEBUG] ${res.error}`;
        }
      } else if (messageContent.stickerMessage) {
        type = 'sticker'; content = '[Figurinha]'; mimeType = 'image/webp';
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.stickerMessage.url, 'sticker.webp', mimeType, req.body, tenantId);
        mediaUrl = res.url; if (res.error) content = `[DEBUG] ${res.error}`;
      } else if (messageContent.contactMessage) {
        type = 'contact';
        const contact = messageContent.contactMessage;
        fileName = contact.displayName || 'Contato';
        content = `[Contato] ${fileName}`;
        const vcard = contact.vcard || "";
        const telMatch = vcard.match(/TEL(?:;[^:]+)*:([+\d\s-]+)/);
        if (telMatch) mediaUrl = telMatch[1].replace(/\D/g, "");
      } else if (messageContent.contactsArrayMessage) {
        type = 'contact';
        const contacts = messageContent.contactsArrayMessage.contacts || [];
        const firstContact = contacts[0];
        fileName = contacts.length > 1 ? `${firstContact?.displayName} e mais ${contacts.length - 1}` : (firstContact?.displayName || 'Contatos');
        content = `[Contatos] ${fileName}`;
        const vcard = firstContact?.vcard || "";
        const telMatch = vcard.match(/TEL(?:;[^:]+)*:([+\d\s-]+)/);
        if (telMatch) mediaUrl = telMatch[1].replace(/\D/g, "");
      } else if (messageContent.locationMessage || messageContent.liveLocationMessage) {
        type = 'location';
        const loc = messageContent.locationMessage || messageContent.liveLocationMessage;
        const lat = loc.degreesLatitude;
        const lng = loc.degreesLongitude;
        fileName = loc.name || 'Localização';
        content = `[Localização] ${fileName}`;
        mediaUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }

      await supabase.from('mensagens').upsert({
        conversation_id: conv?.id, 
        content, 
        sender: isFromMe ? 'agent' : 'client', 
        sender_name: isFromMe ? 'Sistema' : (pushName || phone), 
        type, 
        media_url: mediaUrl,
        mime_type: mimeType, 
        file_name: fileName, 
        external_message_id: key.id, 
        status: isFromMe ? 'sent' : 'delivered', 
        tenant_id: tenantId
      }, { onConflict: 'external_message_id' });

      const updatePayload: any = { 
        last_message: content, 
        last_message_time: new Date().toISOString() 
      };
      
      // Se a mensagem veio do cliente e a conversa estava encerrada, reabre
      if (!isFromMe && conv?.status === 'resolvido') {
        updatePayload.status = 'aguardando';
      }

      await supabase.from('conversas').update(updatePayload).eq('id', conv?.id);

    } else if (normalizedEvent === 'messages.update') {
      const updates = Array.isArray(data) ? data : [data];
      for (const u of updates) {
        const k = u.key || u.update?.key;
        const s = u.update?.status || u.status;
        if (!k?.id || s === undefined) continue;
        let dbS = 'sent';
        if (s === 'DELIVERY_ACK' || s === 3) dbS = 'delivered';
        if (s === 'READ' || s === 4 || s === 'PLAYED' || s === 5) dbS = 'read';
        await supabase.from('mensagens').update({ status: dbS }).eq('external_message_id', k.id);
      }
    } else if (normalizedEvent === 'contacts.upsert' || normalizedEvent === 'contacts.update' || normalizedEvent === 'contacts.set') {
      const contacts = Array.isArray(data) ? data : [data];
      for (const c of contacts) {
        const remoteJid = c.id || c.remoteJid;
        if (!remoteJid) continue;
        
        const isGrp = remoteJid.endsWith('@g.us');
        const phone = isGrp ? remoteJid : remoteJid.split('@')[0];
        
        const pic = c.profilePicUrl || c.imgUrl || c.data?.profilePicUrl;
        const name = c.pushName || c.name || c.data?.pushName;
        
        if (phone) {
          const upd: any = {};
          if (pic) upd.client_avatar = pic;
          
          // Verificar se número pertence a um cliente para não sobrescrever com nome genérico do WhatsApp
          const searchPhones = [phone];
          if (phone.startsWith('55')) searchPhones.push(phone.substring(2));
          else searchPhones.push('55' + phone);

          const { data: matchedCustomer } = await supabase
            .from('clientes')
            .select('id, nome_fantasia, responsavel')
            .or(`whatsapp.in.(${searchPhones.join(',')}),telefone.in.(${searchPhones.join(',')})`)
            .maybeSingle();

          if (matchedCustomer) {
            upd.client_name = matchedCustomer.responsavel || matchedCustomer.nome_fantasia;
            upd.customer_id = matchedCustomer.id;
          } else if (name) {
            upd.client_name = name;
          }

          if (Object.keys(upd).length > 0) {
            await supabase.from('conversas').update(upd).eq('client_phone', phone);
          }
        }
      }
    } else if (normalizedEvent === 'presence.update') {
      const presences = data.presences || {};
      for (const jid in presences) {
        const presence = presences[jid];
        const isTyping = presence.lastKnownPresence === 'composing';
        const phone = jid.split('@')[0];
        await supabase.from('conversas').update({ is_typing: isTyping }).eq('client_phone', phone);
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}