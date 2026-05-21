import { supabase } from "./supabase";

let DYNAMIC_CONFIG = {
  url: "",
  key: "",
  instance: ""
};

function isValidInstanceName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export function updateEvolutionConfig(config: { url?: string; key?: string; instance?: string }) {
  if (config.url) DYNAMIC_CONFIG.url = config.url;
  if (config.key) DYNAMIC_CONFIG.key = config.key;
  if (config.instance && isValidInstanceName(config.instance)) {
    DYNAMIC_CONFIG.instance = config.instance;
  }
}

function resolveInstance(): string {
  const candidates = [
    DYNAMIC_CONFIG.instance,
    localStorage.getItem("evolution_instance"),
    import.meta.env.VITE_INSTANCE_NAME,
    "SASAKI"
  ];
  for (const c of candidates) {
    if (c && isValidInstanceName(c.trim())) return c.trim();
  }
  return "SASAKI";
}

const EVO_CONFIG = {
  getUrl: () => DYNAMIC_CONFIG.url || localStorage.getItem("evolution_url") || import.meta.env.VITE_EVOLUTION_URL || "",
  getKey: () => DYNAMIC_CONFIG.key || localStorage.getItem("evolution_key") || import.meta.env.VITE_EVOLUTION_API_KEY || "",
  getInstance: () => resolveInstance(),
};


function getApiUrl(path: string = "") {
  let url = EVO_CONFIG.getUrl().trim();
  if (!url.startsWith("http")) url = "https://" + url;
  return url + path;
}

export async function fetchMessages(phone: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  console.log(`[Evolution] Buscando mensagens. Instância: ${instance}, URL: ${url}`);
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const phoneClean = phone.replace(/\D/g, "");
  const apiUrl = getApiUrl();
  
  try {
    // Buscar todas as conversas
    const res = await fetch(`${apiUrl}/chat/getMessages/${instance}`, {
      headers: { "apikey": key },
    });
    
    if (res.ok) {
      const data = await res.json();
      const messages = data.messages || [];
      // Filtrar mensagens do número
      const filtered = messages.filter((m: any) => m.from === phoneClean || m.from === "55" + phoneClean);
      return { success: true, messages: filtered };
    }
    return { success: false, error: "Erro ao buscar" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function fetchChats() {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, chats: [] };
  
  const apiUrl = getApiUrl();
  
  try {
    const res = await fetch(`${apiUrl}/chat/getMessages/${instance}`, {
      headers: { "apikey": key },
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: true, messages: data.messages || [] };
    }
    return { success: false, chats: [] };
  } catch {
    return { success: false, chats: [] };
  }
}

export async function syncEvolutionGroups(tenantId: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const apiUrl = getApiUrl();
  
  try {
    const res = await fetch(`${apiUrl}/group/fetchAllGroups/${instance}?getParticipants=false`, {
      headers: { "apikey": key },
    });
    
    if (res.ok) {
      const groups = await res.json();
      if (!Array.isArray(groups)) return { success: false, error: "Formato inválido" };
      
      let count = 0;
      for (const g of groups) {
        const remoteJid = g.id || g.remoteJid;
        const subject = g.subject || g.name || g.subjectOwner;
        const pic = g.profilePicUrl || g.imgUrl || g.picture;
        
        if (!remoteJid || !subject) continue;
        
        const now = new Date();
        const slaDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const { error } = await supabase.from('conversas').upsert({
          client_name: subject,
          client_phone: remoteJid,
          status: 'novo',
          tenant_id: tenantId,
          client_avatar: pic,
          is_group: true,
          sla_deadline: slaDeadline.toISOString(),
          last_message_time: now.toISOString()
        }, { onConflict: 'client_phone,tenant_id' });
        
        if (!error) count++;
      }
      return { success: true, count };
    }
    return { success: false, error: "Erro ao buscar grupos da Evolution" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendWhatsAppMessage(phone: string, message: string, agentName?: string, quotedMessageId?: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  console.log(`[Evolution] Enviando mensagem. Instância: ${instance}, Para: ${phone}, Quoted: ${quotedMessageId || "Nenhum"}`);
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const apiUrl = getApiUrl();
  const phoneNumber = phone.replace(/\D/g, "");

  // Adicionar assinatura se houver nome do agente
  const messageWithSign = agentName 
    ? `*${agentName}*\n\n${message}` 
    : message;
  
  try {
    const payload: any = {
      number: phoneNumber,
      text: messageWithSign,
    };

    if (quotedMessageId) {
      payload.quoted = {
        key: {
          id: quotedMessageId
        }
      };
    }

    const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
      },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.message || `Erro ${res.status}: Verifique se a instância '${instance}' existe e se a chave está correta.` 
      };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendReaction(phone: string, messageId: string, emoji: string, messageKey?: any) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  try {
    const remoteJid = messageKey?.remoteJid || `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    
    // Evolution v2 Payload
    const payload: any = {
      key: {
        remoteJid: remoteJid,
        fromMe: messageKey ? messageKey.fromMe : false,
        id: messageId,
        participant: messageKey?.participant || null
      },
      reaction: emoji
    };

    console.log("[Evolution] Enviando reação v2:", payload);

    const res = await fetch(`${getApiUrl()}/message/sendReaction/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) return { success: true };
    
    // Fallback para v1/v2 antigo se falhar
    const resFallback = await fetch(`${getApiUrl()}/message/reaction/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        reaction: emoji,
        messageId: messageId,
        remoteJid: remoteJid,
        ...payload
      })
    });

    if (resFallback.ok) return { success: true };

    const errorData = await resFallback.text();
    console.error("Evolution Reaction Error:", errorData);
    return { success: false, error: `Erro API: ${errorData}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function deleteMessage(phone: string, messageId: string, messageKey?: any) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  try {
    const remoteJid = messageKey?.remoteJid || `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    
    // Evolution v2 Professional Payload (Revoke para todos)
    const payload = {
      messageKeys: [{
        remoteJid: remoteJid,
        fromMe: messageKey ? messageKey.fromMe : true,
        id: messageId,
        participant: messageKey?.participant || null
      }]
    };

    console.log("[Evolution] Revogando mensagem v2:", payload);

    // Tentar o endpoint de deleteMessages (mais robusto no v2)
    const res = await fetch(`${getApiUrl()}/message/deleteMessages/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) return { success: true };

    // Fallback para delete simples
    const resFallback = await fetch(`${getApiUrl()}/message/delete/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify(payload)
    });

    if (resFallback.ok) return { success: true };

    const errorData = await resFallback.text();
    return { success: false, error: errorData };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendMediaMessage(phone: string, mediaUrl: string, type: "image" | "video" | "document", fileName?: string, caption?: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const apiUrl = getApiUrl();
  const phoneNumber = phone.replace(/\D/g, "");

  const endpoint = "/message/sendMedia";
  
  try {
    const res = await fetch(`${apiUrl}${endpoint}/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
      },
      body: JSON.stringify({
        number: phoneNumber,
        media: mediaUrl,
        mediatype: type,
        fileName: fileName || "arquivo",
        caption: caption || "",
      }),
    });
    
    if (res.ok) return { success: true, data: await res.json() };
    return { success: false, error: "Erro ao enviar mídia" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendAudioMessage(phone: string, audioUrl: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const apiUrl = getApiUrl();
  const phoneNumber = phone.replace(/\D/g, "");
  
  try {
    const res = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
      },
      body: JSON.stringify({
        number: phoneNumber,
        audio: audioUrl,
      }),
    });
    
    if (res.ok) return { success: true, data: await res.json() };
    return { success: false, error: "Erro ao enviar áudio" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// IMPLEMENTAÇÃO 7: checkConnection com TTL de 30 segundos
export async function checkConnection() {
  // Cache com TTL de 30 segundos
  try {
    const cached = localStorage.getItem("wa_connection_cache");
    if (cached) {
      const { connected, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 30_000) return { connected };
    }
  } catch { localStorage.removeItem("wa_connection_cache"); }
  
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { connected: false };
  
  const apiUrl = getApiUrl();
  
  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
      headers: { "apikey": key },
      signal: AbortSignal.timeout(5000)
    });
    
    if (res.ok) {
      const data = await res.json();
      const connected = data.state === "open" || data.instance?.state === "open";
      localStorage.setItem("wa_connection_cache", JSON.stringify({ connected, timestamp: Date.now() }));
      return { connected, phone: data.phoneNumber };
    }
    localStorage.removeItem("wa_connection_cache");
    return { connected: false };
  } catch {
    localStorage.removeItem("wa_connection_cache");
    return { connected: false };
  }
}

export async function fetchQRCode() {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  try {
    const res = await fetch(`${getApiUrl()}/instance/connect/${instance}`, {
      headers: { "apikey": key }
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: true, code: data.base64 || data.code || data.qrcode?.base64 };
    }
    return { success: false, error: "Instância já conectada ou erro na API" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function logoutInstance() {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  if (!url || !key) return;
  try {
    await fetch(`${getApiUrl()}/instance/logout/${instance}`, {
      method: "DELETE",
      headers: { "apikey": key }
    });
    localStorage.removeItem("wa_connection_cache");
  } catch {}
}

// IMPLEMENTAÇÃO 10: sendTypingStatus
export async function sendTypingStatus(phone: string, typing: boolean) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  if (!url || !key) return;
  try {
    await fetch(`${getApiUrl()}/chat/updatePresence/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        options: { presence: typing ? "composing" : "paused" }
      })
    });
  } catch { /* Silencioso — não crítico */ }
}

// IMPLEMENTAÇÃO 10: markAsRead
export async function markAsRead(phone: string, messageId: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  if (!url || !key) return;
  try {
    await fetch(`${getApiUrl()}/chat/markMessageAsRead/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify({
        readMessages: [{
          remoteJid: `${phone.replace(/\D/g, "")}@s.whatsapp.net`,
          fromMe: false,
          id: messageId
        }]
      })
    });
  } catch { /* Silencioso */ }
}

export async function syncConversationHistory(phone: string, tenantId: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const phoneClean = phone.replace(/\D/g, "");
  const remoteJid = `${phoneClean}@s.whatsapp.net`;
  
  try {
    // Endpoint correto para histórico completo
    const res = await fetch(`${url.replace(/\/$/, "")}/chat/fetchMessages/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify({
        number: phoneClean,
        options: { limit: 100 }  // últimas 100 mensagens
      })

    });
    
    if (!res.ok) return { success: false, error: "Erro ao buscar histórico" };
    
    const data = await res.json();
    const messages = data.messages?.records || data.messages || data || [];
    
    return { success: true, messages: Array.isArray(messages) ? messages : [] };
  } catch (err) {
    return { success: false, error: String(err), messages: [] };
  }
}

export async function checkWhatsApp(phone: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { exists: false, error: "API não configurada" };
  
  const phoneClean = phone.replace(/\D/g, "");
  
  try {
    const res = await fetch(`${getApiUrl()}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify({ numbers: [phoneClean] })
    });
    
    if (res.ok) {
      const data = await res.json();
      const result = data[0] || {};
      return { exists: result.exists || false, jid: result.jid };
    }
    return { exists: false, error: "Erro ao verificar" };
  } catch (err) {
    return { exists: false, error: String(err) };
  }
}

export async function fetchGroupInfo(groupJid: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  try {
    const res = await fetch(`${getApiUrl()}/group/findGroupInfos/${instance}?groupJid=${groupJid}`, {
      headers: { "apikey": key }
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    return { success: false, error: "Erro ao buscar informações do grupo" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}