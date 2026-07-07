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

    if (!buffer && evoUrl && evoKey) {
      const instName = fullMessage?.instance || fullMessage?.data?.instance || instance;
      const msgId = fullMessage?.key?.id || fullMessage?.data?.key?.id || fullMessage?.message?.key?.id;
      const instId = fullMessage?.instanceId || fullMessage?.data?.instanceId;
      
      if (msgId) {
        const encName = encodeURIComponent(instName);
        const downloadEndpoints = [
          `${evoUrl}/chat/getBase64FromMediaMessage/${encName}`,
          `${evoUrl}/message/convert/toBase64/${encName}`,
          `${evoUrl}/message/getMedia/${encName}`
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

    if (!buffer) {
      const mediaUrls = [mediaPath];
      if (!mediaPath.startsWith("http")) {
        mediaUrls.push(`${evoUrl}${mediaPath.startsWith("/") ? "" : "/"}${mediaPath}`);
      }
      for (const url of mediaUrls) {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10000)
          });
          if (response.ok) {
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('image') || ct.includes('audio') || ct.includes('video') || ct.includes('application/') || ct.includes('octet-stream')) {
              buffer = Buffer.from(await response.arrayBuffer());
              console.log(`[Webhook] Mídia baixada de ${url} (${buffer.length} bytes)`);
              break;
            }
          }
        } catch (e) {
          console.log(`[Webhook] Download direto falhou para ${url}`);
        }
      }
    }

    if (!buffer || buffer.length < 100) {
      return { 
        url: '',
        error: diagError || "Download failed"
      };
    }

    const tDir = tenantId || "shared";
    const storagePath = `${tDir}/${Date.now()}_${(fileName || "file").replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { error } = await supabase.storage.from("chat-media").upload(storagePath, buffer, { 
      contentType: mimeType || "application/octet-stream", 
      upsert: true 
    });

    if (error) return { url: '', error: `Upload err: ${error.message}` };

    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(storagePath);
    return { url: publicUrl };
  } catch (err: any) {
    return { url: '', error: `Critical: ${err.message}` };
  }
}

function toNum(val: any) {
  if (typeof val === 'object' && val !== null) return val.low || 0;
  return typeof val === 'number' ? val : 0;
}

function analyzeAndHygienize(phone: string) {
  const original = phone;
  let cleaned = phone.replace(/\D/g, "");
  let ddi = "55";
  let ddd = "";
  let status_normalizacao = "NORMALIZADO";
  let tipo_numero = "DESCONHECIDO";
  let status_validacao = "VALIDO";
  let motivo_validacao = "";

  if (!cleaned) {
    return { status_normalizacao: "FORMATO_INVALIDO", status_validacao: "INVALIDO", motivo_validacao: "Vazio" };
  }

  // 1. DDI & DDD Extraction
  if (cleaned.startsWith("55")) {
    ddi = "55";
    if (cleaned.length >= 4) ddd = cleaned.substring(2, 4);
  } else {
    ddi = "55";
    if (cleaned.length >= 2) ddd = cleaned.substring(0, 2);
    cleaned = "55" + cleaned;
  }

  if (!ddd || ddd.length < 2) {
    status_normalizacao = "PENDENTE_DDD";
    status_validacao = "PENDENTE_REVISAO";
    motivo_validacao = "DDD não identificado";
  }

  // 2. Tipo de Número & Validação
  const numberPart = cleaned.startsWith("55") ? cleaned.substring(4) : cleaned.substring(2);
  const firstDigit = numberPart[0];

  if (["2", "3", "4", "5"].includes(firstDigit)) {
    tipo_numero = "FIXO";
  } else if (["6", "7", "8", "9"].includes(firstDigit)) {
    tipo_numero = "MOVEL";
  } else {
    tipo_numero = "INVALIDO";
    status_validacao = "INVALIDO";
    motivo_validacao = "Início de número inválido";
  }

  // 3. Regras de Comprimento (Brazil)
  if (tipo_numero === "MOVEL") {
    if (numberPart.length === 8) {
      status_validacao = "SEM_NONO_DIGITO";
      motivo_validacao = "Celular sem o dígito 9";
    } else if (numberPart.length === 9) {
      if (firstDigit !== "9") {
        status_validacao = "INVALIDO";
        motivo_validacao = "Celular com 9 dígitos não inicia com 9";
      }
    } else if (numberPart.length > 9) {
      status_validacao = "DIGITOS_EXCEDENTES";
      motivo_validacao = "Número muito longo";
    } else {
      status_validacao = "INCOMPLETO";
      motivo_validacao = "Número muito curto";
    }
  } else if (tipo_numero === "FIXO") {
    if (numberPart.length !== 8) {
      status_validacao = "INCOMPLETO";
      motivo_validacao = "Fixo deve ter 8 dígitos";
    }
  }

  return {
    ddi,
    ddd,
    telefone: original,
    telefone_formatado: cleaned,
    status_normalizacao,
    tipo_numero,
    status_validacao,
    motivo_validacao
  };
}

function canonicalPhone(phone: string): string {
  const result = analyzeAndHygienize(phone);
  return result.telefone_formatado || phone;
}

function getBrazilianPhoneVariations(phone: string): string[] {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return [];

  // Remove leading 55 if present to work with the local number
  let isBr = false;
  let local = cleaned;
  if (cleaned.startsWith("55") && cleaned.length >= 10) {
    isBr = true;
    local = cleaned.substring(2);
  } else if (cleaned.length >= 10 && cleaned.length <= 11) {
    // If it looks like a Brazilian number without 55 (e.g. 10 or 11 digits)
    isBr = true;
  }

  if (!isBr) {
    // Non-Brazilian or too short: just return standard variations
    return Array.from(new Set([cleaned, "55" + cleaned].filter(Boolean)));
  }

  // It's a Brazilian number. Let's extract DDD and the rest.
  const ddd = local.substring(0, 2);
  const rest = local.substring(2);

  const variations = new Set<string>();

  // Add the cleaned number itself
  variations.add(cleaned);
  variations.add("55" + local);
  variations.add(local);

  // Generate 9th digit variations
  if (rest.length === 9 && rest.startsWith("9")) {
    // It has the 9th digit. Generate the version without it.
    const without9 = ddd + rest.substring(1);
    variations.add(without9);
    variations.add("55" + without9);
  } else if (rest.length === 8) {
    // It does not have the 9th digit. Generate the version with it.
    const with9 = ddd + "9" + rest;
    variations.add(with9);
    variations.add("55" + with9);
  }

  return Array.from(variations);
}

async function findTenantByInstance(name: string, supabase: any): Promise<string | null> {
  // 1. Tentar evolution_instance (coluna pode ou não existir)
  try {
    const { data: t1 } = await supabase.from('tenants').select('id').eq('evolution_instance', name).maybeSingle();
    if (t1?.id) return t1.id;
  } catch {}

  // 2. Tentar instance_name na mesma tabela
  try {
    const { data: t2 } = await supabase.from('tenants').select('id').eq('instance_name', name).maybeSingle();
    if (t2?.id) return t2.id;
  } catch {}

  // 3. Buscar em company_settings (tem instance_name mapeado para tenant)
  try {
    const { data: cs } = await supabase.from('company_settings').select('tenant_id').eq('instance_name', name).maybeSingle();
    if (cs?.tenant_id) return cs.tenant_id;
  } catch {}

  return null;
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

  const tWebhookStart = performance.now();
  const { event, data, instance: instPayload } = req.body || {};
  if (!event || !data) return res.status(400).json({ error: 'Invalid payload' });

  console.log(`[TIMING] Webhook recebido: ${event} às ${new Date().toISOString()}`);

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
      const groupSubject = data.subject || msg.subject || '';
      const remoteJid = key?.remoteJid;
      if (!remoteJid) return res.status(200).json({ success: true });

      const isGroup = remoteJid.endsWith('@g.us');
      const rawPhone = isGroup ? remoteJid : remoteJid.split('@')[0];
      const phone = isGroup ? rawPhone : canonicalPhone(rawPhone);
      const isFromMe = !!key?.fromMe;
      
      const instName = instPayload || req.headers['x-instance-name'] as string || "";
      let tId: string | null = null;

      if (instName) {
        tId = await findTenantByInstance(instName, supabase);
      }

      // Fallback: pegar o primeiro tenant disponível
      if (!tId) {
        const { data: anyTenant } = await supabase.from('tenants').select('id').limit(1).maybeSingle();
        if (anyTenant?.id) {
          tId = anyTenant.id;
        }
      }

      if (!tId) {
        console.error('[Webhook] CRÍTICO: Nenhum tenant encontrado no banco');
        return res.status(200).json({ success: true, detail: 'No tenant configured' });
      }
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

      // 2. Garantir que a conversa existe (Buscar por variações do telefone para evitar duplicidade)
      const searchConvPhones = getBrazilianPhoneVariations(phone);

      let { data: conv } = await supabase
        .from('conversas')
        .select('*')
        .in('client_phone', searchConvPhones)
        .eq('tenant_id', tId) // tId precisa estar definido antes
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conv) {
        const now = new Date();
        const slaDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 horas de SLA por padrão

        // Gerar protocolo único
        let protocolo = null;
        try {
          const { data: protoResult, error: protoError } = await supabase.rpc('get_next_protocolo', { p_tenant_id: tId }).single();
          if (protoError) {
            console.error(`[Webhook] Erro ao gerar protocolo: ${protoError.message}`);
          } else if (protoResult) {
            protocolo = typeof protoResult === 'object' && protoResult !== null
              ? ((protoResult as any).get_next_protocolo ?? null)
              : protoResult;
          }
        } catch (e) {
          console.error("[Webhook] Erro ao gerar protocolo:", e);
        }

        // Prioridade do nome: 1. Banco Sasaki > 2. WhatsApp > 3. API
        let clientName = '';
        if (matchedCustomer) {
          clientName = matchedCustomer.responsavel || matchedCustomer.nome_fantasia || '';
        }
        if (!clientName) {
          clientName = isGroup ? (groupSubject || pushName || phone) : (pushName || phone);
        }

        const { data: nConv, error: cErr } = await supabase.from('conversas').upsert({
          client_name: clientName, 
          client_phone: phone, 
          customer_id: matchedCustomer?.id || null,
          status: isFromMe ? 'em_atendimento' : 'novo', 
          last_message_time: now.toISOString(), 
          tenant_id: tId,
          client_avatar: profilePic, 
          is_group: isGroup,
          sla_deadline: slaDeadline.toISOString(),
          protocolo: protocolo
        }, { onConflict: 'client_phone,tenant_id' }).select().single();
        if (cErr) {
          console.error(`[Webhook] Erro ao criar conversa:`, cErr.message);
          // Tentar upsert sem protocolo (fallback)
          const { data: nConv2, error: cErr2 } = await supabase.from('conversas').upsert({
            client_name: clientName,
            client_phone: phone,
            customer_id: matchedCustomer?.id || null,
            status: isFromMe ? 'em_atendimento' : 'novo',
            last_message_time: now.toISOString(),
            tenant_id: tId,
            client_avatar: profilePic,
            is_group: isGroup,
          }, { onConflict: 'client_phone,tenant_id' }).select().single();
          if (cErr2) {
            console.error(`[Webhook] Erro ao criar conversa (fallback):`, cErr2.message);
          } else {
            conv = nConv2;
          }
        } else {
          conv = nConv;
        }

        // Log de criação do chamado com protocolo
        if (protocolo && conv?.id) {
          await supabase.from('historico').insert({
            conversation_id: conv.id,
            action: `Chamado criado`,
            details: `Protocolo: #${protocolo}`,
            user_name: isFromMe ? (matchedCustomer?.responsavel || 'Sistema') : (pushName || phone),
            timestamp: now.toISOString()
          });
        }
      } else if (profilePic && conv.client_avatar !== profilePic) {
        // Atualizar avatar se mudou
        await supabase.from('conversas').update({ client_avatar: profilePic }).eq('id', conv.id);
      } else if (isGroup && groupSubject && conv.client_name !== groupSubject) {
        // Atualizar nome do grupo se disponível
        await supabase.from('conversas').update({ client_name: groupSubject }).eq('id', conv.id);
      }

      const tenantId = conv?.tenant_id || tId || '00000000-0000-0000-0000-000000000000';

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

      // ETAPA 1 & 3 — DETECTAR REACTIONMESSAGE E TIPOS ESPECIAIS
      const isReaction = !!messageContent.reactionMessage;
      const isRevoke = !!messageContent.protocolMessage && (messageContent.protocolMessage.type === 'REVOKE' || messageContent.protocolMessage.type === 3);

      if (isReaction) {
        type = 'reaction';
        const reactionEmoji = messageContent.reactionMessage.text || '';
        const targetId = messageContent.reactionMessage.key?.id;
        
        if (targetId) {
          // Atualizar o campo rápido na mensagem principal para reatividade do front
          await supabase.from('mensagens').update({ reaction: reactionEmoji }).eq('external_message_id', targetId);
          
          // ETAPA 5 — CRIAR REGISTRO NA TABELA MESSAGE_REACTIONS
          try {
            await supabase.from('message_reactions').upsert({
              tenant_id: tenantId,
              instance_name: instName,
              wa_message_id: targetId,
              reaction: reactionEmoji,
              reacted_by_jid: key.remoteJid,
              from_me: !!key.fromMe,
              participant: key.participant || null,
              raw_payload: messageContent.reactionMessage
            }, { onConflict: 'wa_message_id,reacted_by_jid' });
          } catch (e) {
            console.error("[Webhook] Erro ao salvar em message_reactions:", e);
          }

          if (!reactionEmoji) {
            await supabase.from('mensagens').update({ reaction: null }).eq('external_message_id', targetId);
          }
          return res.status(200).json({ success: true, detail: 'Reaction processed' });
        }
      }

      if (isRevoke) {
        type = 'revoke';
        const targetId = messageContent.protocolMessage.key?.id;
        if (targetId) {
          await supabase.from('mensagens').update({
            content: 'Mensagem apagada',
            type: 'revoke',
            media_url: null,
            file_name: null,
            mime_type: null,
            file_size: null,
            reaction: null,
          }).eq('external_message_id', targetId);
          return res.status(200).json({ success: true, detail: 'Message revoked' });
        }
      }

      const text = messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.text || '';
      if (text) {
        content = text;
      } else if (messageContent.imageMessage) {
        type = 'image';
        mimeType = messageContent.imageMessage.mimetype;
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.imageMessage.url, 'image.jpg', mimeType, req.body, tenantId);
        mediaUrl = res.url;
        if (res.url && !res.error) {
          content = messageContent.imageMessage.caption || '';
        } else {
          type = 'text';
          content = messageContent.imageMessage.caption || '[Imagem indisponível]';
        }
      } else if (messageContent.videoMessage) {
        type = 'video';
        mimeType = messageContent.videoMessage.mimetype;
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.videoMessage.url, 'video.mp4', mimeType, req.body, tenantId);
        mediaUrl = res.url;
        if (res.url && !res.error) {
          content = messageContent.videoMessage.caption || '';
        } else {
          type = 'text';
          content = messageContent.videoMessage.caption || '[Vídeo indisponível]';
        }
      } else if (messageContent.audioMessage) {
        type = 'audio';
        mimeType = 'audio/ogg'; 
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.audioMessage.url, 'audio.ogg', mimeType, req.body, tenantId);
        mediaUrl = res.url;
        if (res.url && !res.error) {
          content = '';
        } else {
          type = 'text';
          content = '[Áudio indisponível]';
        }
      } else if (messageContent.documentMessage || messageContent.documentWithCaptionMessage) {
        const doc = messageContent.documentMessage || messageContent.documentWithCaptionMessage?.message?.documentMessage;
        if (doc) {
          fileName = doc.fileName || 'document';
          mimeType = doc.mimetype;
          const res = await downloadAndUploadMedia(evoUrl, evoKey, doc.url, fileName, mimeType, req.body, tenantId);
          mediaUrl = res.url;
          if (res.url && !res.error) {
            type = 'document';
            content = doc.caption || '';
          } else {
            type = 'text';
            content = doc.caption || `[Documento indisponível: ${fileName}]`;
          }
        }
      } else if (messageContent.stickerMessage) {
        type = 'sticker';
        mimeType = 'image/webp';
        const res = await downloadAndUploadMedia(evoUrl, evoKey, messageContent.stickerMessage.url, 'sticker.webp', mimeType, req.body, tenantId);
        mediaUrl = res.url;
        if (res.url && !res.error) {
          content = '';
        } else {
          type = 'text';
          content = '[Figurinha indisponível]';
        }
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

      // ETAPA 6 — SALVAR METADADOS COMPLETOS (Com fallback de segurança)
      try {
        const { error: upsertError } = await supabase.from('mensagens').upsert({
          conversation_id: conv?.id, 
          content, 
          sender: isFromMe ? 'agent' : 'client', 
          sender_name: isFromMe ? 'Sistema' : (pushName || phone), 
          type, 
          media_url: mediaUrl,
          mime_type: mimeType, 
          file_name: fileName, 
          external_message_id: key.id, 
          wa_message_id: key.id,
          remote_jid: key.remoteJid,
          from_me: !!key.fromMe,
          participant: key.participant || null,
          message_key_json: key,
          instance_name: instName,
          status: isFromMe ? 'sent' : 'delivered', 
          tenant_id: tenantId
        }, { onConflict: 'external_message_id' });

        if (upsertError) {
          console.error("[Webhook] Erro no upsert completo, tentando simplificado:", upsertError.message);
          // Fallback se as colunas novas não existirem ainda
          await supabase.from('mensagens').upsert({
            conversation_id: conv?.id, 
            content, 
            sender: isFromMe ? 'agent' : 'client', 
            sender_name: isFromMe ? 'Sistema' : (pushName || phone), 
            type, 
            media_url: mediaUrl,
            external_message_id: key.id, 
            status: isFromMe ? 'sent' : 'delivered', 
            tenant_id: tenantId
          }, { onConflict: 'external_message_id' });
        }
      } catch (err) {
        console.error("[Webhook] Erro crítico no salvamento:", err);
      }

      const lastMsg = content || (
        type === 'image' ? '[Imagem]' :
        type === 'video' ? '[Vídeo]' :
        type === 'audio' ? '[Áudio]' :
        type === 'document' ? `[${fileName || 'Documento'}]` :
        type === 'sticker' ? '[Figurinha]' :
        type === 'location' ? '[Localização]' :
        type === 'contact' ? '[Contato]' :
        type === 'reaction' ? '[Reação]' :
        type === 'revoke' ? '[Mensagem apagada]' : content
      );

      const updatePayload: any = { 
        last_message: lastMsg, 
        last_message_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Se a conversa estava encerrada/resolvida, reabre com novo protocolo
      if (conv?.status === 'resolvido') {
        if (!isFromMe) {
          updatePayload.status = 'novo';
          updatePayload.assigned_to = null;

          // Gerar novo protocolo para a nova demanda
          try {
            const { data: protoResult, error: protoError } = await supabase.rpc('get_next_protocolo', { p_tenant_id: tId }).single();
            if (!protoError && protoResult) {
              const novoProtocolo = typeof protoResult === 'object' && protoResult !== null
                ? ((protoResult as any).get_next_protocolo ?? null)
                : protoResult;
              if (novoProtocolo) {
                updatePayload.protocolo = novoProtocolo;
                console.log(`[Webhook] Novo protocolo #${novoProtocolo} gerado para conversa ${conv.id}`);
              }
            }
          } catch (e) {
            console.error("[Webhook] Erro ao gerar novo protocolo na reabertura:", e);
          }
        } else {
          updatePayload.status = 'em_atendimento';
        }
        updatePayload.resolved_at = null;
        console.log(`[Webhook] Reabrindo conversa ${conv.id} - status: resolvido -> ${updatePayload.status}`);
      }

      if (conv?.id) {
        const { error: updateError } = await supabase.from('conversas').update(updatePayload).eq('id', conv.id);
        if (updateError) {
          console.error(`[Webhook] Erro ao atualizar conversa ${conv.id}:`, updateError.message);
        } else if (!isFromMe && updatePayload.protocolo) {
          // Log de reabertura com novo protocolo
          await supabase.from('historico').insert({
            conversation_id: conv.id,
            action: 'Nova demanda',
            details: `Protocolo: #${updatePayload.protocolo}`,
            user_name: pushName || phone,
            timestamp: new Date().toISOString()
          }).catch(e => console.error('[Webhook] Erro ao logar reabertura:', e));
        }
      } else {
        console.error(`[Webhook] conv.id é undefined — não foi possível atualizar conversa`);
      }

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
      const instName = data.instance || req.headers['x-instance-name'] as string || "";
      
      let tId: string | null = null;
      if (instName) {
        tId = await findTenantByInstance(instName, supabase);
      }
      // Fallback: pegar o primeiro tenant disponível
      if (!tId) {
        const { data: anyTenant } = await supabase.from('tenants').select('id').limit(1).maybeSingle();
        if (anyTenant?.id) tId = anyTenant.id;
      }
      // Último fallback: tentar criar conversa sem tenant_id válido (FK pode falhar)
      if (!tId) {
        console.error('[Webhook] CRÍTICO: Nenhum tenant encontrado para contacts event');
        return;
      }

      console.log(`[Webhook] Sincronizando ${contacts.length} contatos da instância ${instName}`);

      for (const c of contacts) {
        const remoteJid = c.id || c.remoteJid;
        if (!remoteJid) continue;
        
        const isGrp = remoteJid.endsWith('@g.us');
        const pic = c.profilePicUrl || c.imgUrl || c.data?.profilePicUrl || c.picture;
        const pushName = c.pushName || c.name || c.data?.pushName || c.subject;

        if (isGrp) {
          if (pushName) {
            const updConv: any = { client_name: pushName };
            if (pic) updConv.client_avatar = pic;
            await supabase.from('conversas').update(updConv).eq('client_phone', remoteJid).eq('tenant_id', tId);
          }
          continue; // Pular grupos na tabela de contatos técnicos por enquanto
        }

        const rawPhone = remoteJid.split('@')[0];
        const hygiene = analyzeAndHygienize(rawPhone);
        
        // Upsert na tabela de contatos técnicos
        const contactData = {
          tenant_id: tId,
          instance_name: instName,
          jid: remoteJid,
          telefone: rawPhone,
          telefone_formatado: hygiene.telefone_formatado,
          nome: pushName,
          nome_exibicao: pushName,
          foto_perfil: pic,
          ddi: hygiene.ddi,
          ddd: hygiene.ddd,
          status_normalizacao: hygiene.status_normalizacao,
          tipo_numero: hygiene.tipo_numero,
          status_validacao: hygiene.status_validacao,
          motivo_validacao: hygiene.motivo_validacao,
          updated_at: new Date().toISOString()
        };

        // Etapa 5: Detecção de Duplicados em tempo real
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('tenant_id', tId)
          .eq('telefone_formatado', hygiene.telefone_formatado)
          .neq('jid', remoteJid)
          .maybeSingle();

        if (existing) {
          contactData.duplicado = true;
          contactData.duplicado_de = existing.id;
          contactData.grupo_duplicidade = hygiene.telefone_formatado;
        }

        await supabase.from('contacts').upsert(contactData, { onConflict: 'jid,tenant_id' });

        // Atualizar dados da conversa se existir
        const updConv: any = {};
        if (pic) updConv.client_avatar = pic;

        // Buscar conversa atual para verificar se já tem nome do CRM
        const { data: existingConv } = await supabase
          .from('conversas')
          .select('id, client_name, customer_id')
          .eq('client_phone', hygiene.telefone_formatado)
          .eq('tenant_id', tId)
          .maybeSingle();

        if (existingConv) {
          // Já tem customer_id (cliente vinculado) — NÃO substituir o nome
          if (!existingConv.customer_id) {
            // Buscar cliente por número
            const { data: matchedCustomer } = await supabase
              .from('clientes')
              .select('id, nome_fantasia, responsavel')
              .or(`whatsapp.eq.${hygiene.telefone_formatado},telefone.eq.${hygiene.telefone_formatado}`)
              .maybeSingle();

            if (matchedCustomer) {
              // Prioridade 1: Nome salvo no banco Sasaki (já existe, não substituir)
              // Prioridade 2: Nome sincronizado do WhatsApp (pushName)
              // Prioridade 3: Nome retornado pela API
              if (!existingConv.client_name || existingConv.client_name === existingConv.client_phone) {
                updConv.client_name = matchedCustomer.responsavel || matchedCustomer.nome_fantasia;
              }
              updConv.customer_id = matchedCustomer.id;
            } else if (pushName && (!existingConv.client_name || existingConv.client_name === existingConv.client_phone)) {
              updConv.client_name = pushName;
            }
          }
          // Se já tem customer_id, nunca substituir o nome cadastrado
        }

        if (Object.keys(updConv).length > 0) {
          await supabase.from('conversas').update(updConv).eq('id', existingConv.id);
        }

      }

      // Log de Sincronização
      await supabase.from('contact_sync_logs').insert({
        tenant_id: tId,
        instance_name: instName,
        evento_recebido: normalizedEvent,
        quantidade_contatos: contacts.length,
        status: 'SUCCESS'
      });

    } else if (normalizedEvent === 'presence.update') {
      const presences = data.presences || {};
      for (const jid in presences) {
        const presence = presences[jid];
        const isTyping = presence.lastKnownPresence === 'composing';
        const phone = jid.split('@')[0];
        await supabase.from('conversas').update({ is_typing: isTyping }).eq('client_phone', phone);
      }
    } else if (normalizedEvent === 'messages.reaction') {
      // Registrar reação na mensagem
      const reaction = data.reaction || data;
      if (reaction && reaction.key && reaction.key.id) {
        const messageId = reaction.key.id;
        const emoji = reaction.text;
        
        // Atualizar a mensagem com a última reação
        await supabase.from('mensagens').update({
          reaction: emoji
        }).eq('external_message_id', messageId);
      }
    } else if (normalizedEvent === 'messages.delete') {
      const key = data.key || data;
      if (key && key.id) {
        await supabase.from('mensagens').update({
          content: 'Mensagem apagada',
          type: 'revoke',
          media_url: null,
          file_name: null,
          mime_type: null,
          file_size: null,
          reaction: null,
        }).eq('external_message_id', key.id);
      }
    }
    const tWebhookEnd = performance.now();
    console.log(`[TIMING] Webhook processado (${event}): ${(tWebhookEnd - tWebhookStart).toFixed(0)}ms`);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error(`[TIMING] Webhook ERRO (${event}):`, error?.message || error, error?.stack ? error.stack.substring(0, 500) : '');
    return res.status(500).json({ error: error?.message || String(error), detail: error?.details || error?.hint || '', code: error?.code || '' });
  }
}