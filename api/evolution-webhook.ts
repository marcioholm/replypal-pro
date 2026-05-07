// VERSION: 2026-05-07 03:08 - AUDIO FIX
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadAndUploadMedia(evolutionUrl: string, apikey: string, mediaPath: string, fileName: string, mimeType: string, fullMessage: any): Promise<string> {
  const evoUrl = (process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || evolutionUrl || "").replace(/\/$/, "");
  const evoKey = process.env.EVOLUTION_API_KEY || process.env.VITE_EVOLUTION_API_KEY || apikey || "";
  const instance = fullMessage?.instance || process.env.INSTANCE_NAME || "SASAKI";

  try {
    let buffer: Buffer | null = null;

    const findBase64 = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      // Se acharmos uma chave 'base64', verificamos se é grande o suficiente (> 10KB)
      if (obj.base64 && typeof obj.base64 === 'string' && obj.base64.length > 10000) return obj.base64;
      for (const key in obj) {
        const result = findBase64(obj[key]);
        if (result) return result;
      }
      return null;
    };

    const b64 = findBase64(fullMessage);
    if (b64) {
      console.log(`Webhook Media: High-quality Base64 found (${b64.length} bytes)`);
      const clean = b64.includes('base64,') ? b64.split('base64,')[1] : b64;
      buffer = Buffer.from(clean, 'base64');
    }

    if (!buffer && evoUrl && evoKey) {
      const instanceId = fullMessage?.instanceId || fullMessage?.data?.instanceId;
      const ids = [instance, instanceId].filter(Boolean);
      const v2Payload = fullMessage.data || fullMessage;
      
      const endpoints: string[] = [];
      for (const id of ids) {
        const encId = encodeURIComponent(id as string);
        endpoints.push(`${evoUrl}/message/convert/toBase64/${encId}`);
        endpoints.push(`${evoUrl}/chat/getBase64FromMediaMessage/${encId}`);
      }

      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify(v2Payload)
          });
          if (res.ok) {
            const json = await res.json();
            const dataB64 = json.base64 || json.data?.base64;
            if (dataB64) {
              buffer = Buffer.from(dataB64.includes('base64,') ? dataB64.split('base64,')[1] : dataB64, 'base64');
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (!buffer) {
      const fileNameId = mediaPath.split('/').pop()?.split('?')[0] || fileName;
      const encInstance = encodeURIComponent(instance);
      const evoPublicUrl = `${evoUrl}/public/media/${encInstance}/${fileNameId}`;
      const urls = [evoPublicUrl, mediaPath];
      
      for (const dUrl of urls) {
        try {
          const res = await fetch(dUrl, { 
            headers: dUrl === mediaPath ? {} : { 'apikey': evoKey }
          });
          if (res.ok) {
            const tmp = Buffer.from(await res.arrayBuffer());
            if (tmp.length > 100) { 
              buffer = tmp;
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (!buffer) return mediaPath.startsWith("http") ? mediaPath : `${evoUrl}/public/${mediaPath}`;

    const safeName = (fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `incoming/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from("chat-media").upload(storagePath, buffer, { 
      contentType: mimeType || "application/octet-stream", 
      upsert: true 
    });

    if (error) return mediaPath;
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(storagePath);
    return publicUrl;
  } catch (err) {
    return mediaPath;
  }
}

function toNum(val: any) {
  if (typeof val === 'object' && val !== null) return val.low || 0;
  return typeof val === 'number' ? val : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return res.status(200).json({ status: 'online' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { event, data, instance: instPayload } = req.body || {};
  if (!event || !data) return res.status(400).json({ error: 'Invalid payload' });

  try {
    const evoUrl = (process.env.EVOLUTION_URL || "").replace(/\/$/, "");
    const evoKey = process.env.EVOLUTION_API_KEY || "";

    if (event === 'messages.upsert') {
      const msg = data.message || data;
      const key = msg.key || data.key;
      const messageContent = msg.message || data.message;
      const pushName = data.pushName || msg.pushName || '';
      const remoteJid = key?.remoteJid;
      if (!remoteJid || key?.fromMe) return res.status(200).json({ success: true });

      const phone = remoteJid.split('@')[0];
      const DEFAULT_TENANT = '11111111-1111-1111-1111-111111111111';

      let { data: conv } = await supabase.from('conversas').select('id, tenant_id').eq('client_phone', phone).maybeSingle();

      if (!conv) {
        const instName = instPayload || req.headers['x-instance-name'] as string || "";
        let tId = DEFAULT_TENANT;
        if (instName) {
          const { data: tCfg } = await supabase.from('tenants').select('id').eq('evolution_instance', instName).maybeSingle();
          if (tCfg) tId = tCfg.id;
        }
        const { data: nConv, error: cErr } = await supabase.from('conversas').insert({
          client_name: pushName || phone, client_phone: phone, status: 'novo', last_message_time: new Date().toISOString(), tenant_id: tId
        }).select().single();
        if (cErr) throw cErr;
        conv = nConv;
      }

      const tenantId = conv?.tenant_id || DEFAULT_TENANT;
      let type = 'text', content = '', mediaUrl = null, mimeType = null, fileName = null, fileSize = null, duration = null;

      const text = messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.text || '';
      if (text) {
        content = text;
      } else if (messageContent.imageMessage) {
        type = 'image'; content = messageContent.imageMessage.caption || '[Imagem]';
        mimeType = messageContent.imageMessage.mimetype;
        mediaUrl = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.imageMessage.url, 'image.jpg', mimeType, req.body);
      } else if (messageContent.videoMessage) {
        type = 'video'; content = messageContent.videoMessage.caption || '[Video]';
        mimeType = messageContent.videoMessage.mimetype;
        mediaUrl = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.videoMessage.url, 'video.mp4', mimeType, req.body);
      } else if (messageContent.audioMessage) {
        type = 'audio'; content = '[Audio]';
        mimeType = messageContent.audioMessage.mimetype || 'audio/ogg';
        // Garantir que o áudio tenha a extensão correta para o Supabase
        mediaUrl = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.audioMessage.url, 'audio.ogg', mimeType, req.body);
      } else if (messageContent.documentMessage) {
        type = 'document'; fileName = messageContent.documentMessage.fileName || 'document';
        content = fileName; mimeType = messageContent.documentMessage.mimetype;
        mediaUrl = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.documentMessage.url, fileName, mimeType, req.body);
      } else if (messageContent.stickerMessage) {
        type = 'sticker'; content = '[Figurinha]'; mimeType = 'image/webp';
        mediaUrl = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.stickerMessage.url, 'sticker.webp', mimeType, req.body);
      }

      await supabase.from('mensagens').upsert({
        conversation_id: conv?.id, content, sender: 'client', sender_name: phone, type, media_url: mediaUrl,
        mime_type: mimeType, file_name: fileName, external_message_id: key.id, status: 'delivered', tenant_id: tenantId
      }, { onConflict: 'external_message_id' });

      await supabase.from('conversas').update({ last_message: content, last_message_time: new Date().toISOString() }).eq('id', conv?.id);

    } else if (event === 'messages.update') {
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
    } else if (event === 'contacts.upsert' || event === 'contacts.update') {
      const contacts = Array.isArray(data) ? data : [data];
      for (const c of contacts) {
        const phone = c.id?.split('@')[0] || c.remoteJid?.split('@')[0];
        const pic = c.profilePicUrl || c.imgUrl;
        const name = c.pushName || c.name;
        if (phone && (pic || name)) {
          const upd: any = {};
          if (pic) upd.client_avatar = pic;
          if (name) upd.client_name = name;
          await supabase.from('conversas').update(upd).eq('client_phone', phone);
        }
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}