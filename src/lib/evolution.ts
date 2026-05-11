import { supabase } from "./supabase";

let DYNAMIC_CONFIG = {
  url: "",
  key: "",
  instance: ""
};

export function updateEvolutionConfig(config: { url?: string; key?: string; instance?: string }) {
  if (config.url) DYNAMIC_CONFIG.url = config.url;
  if (config.key) DYNAMIC_CONFIG.key = config.key;
  if (config.instance) DYNAMIC_CONFIG.instance = config.instance;
}

const EVO_CONFIG = {
  getUrl: () => DYNAMIC_CONFIG.url || localStorage.getItem("evolution_url") || import.meta.env.VITE_EVOLUTION_URL || "",
  getKey: () => DYNAMIC_CONFIG.key || localStorage.getItem("evolution_key") || import.meta.env.VITE_EVOLUTION_API_KEY || "",
  getInstance: () => DYNAMIC_CONFIG.instance || localStorage.getItem("evolution_instance") || import.meta.env.VITE_INSTANCE_NAME || "SASAKI",
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

export async function sendWhatsAppMessage(phone: string, message: string, agentName?: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  console.log(`[Evolution] Enviando mensagem. Instância: ${instance}, Para: ${phone}`);
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const apiUrl = getApiUrl();
  const phoneNumber = phone.replace(/\D/g, "");

  // Adicionar assinatura se houver nome do agente
  const messageWithSign = agentName 
    ? `*Atendente: ${agentName}*\n\n${message}` 
    : message;
  
  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: messageWithSign,
      }),
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const errorData = await res.json().catch(() => ({}));
    return { success: false, error: errorData.message || "Erro ao enviar" };
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