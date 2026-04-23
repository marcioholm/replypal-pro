import { supabase } from "./supabase";

const EVO_CONFIG = {
  getUrl: () => localStorage.getItem("evolution_url") || import.meta.env.VITE_EVOLUTION_URL || "",
  getKey: () => localStorage.getItem("evolution_key") || import.meta.env.VITE_EVOLUTION_API_KEY || "",
  getInstance: () => localStorage.getItem("evolution_instance") || import.meta.env.VITE_INSTANCE_NAME || "SASAKI",
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

export async function sendWhatsAppMessage(phone: string, message: string) {
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  const apiUrl = getApiUrl();
  const phoneNumber = phone.replace(/\D/g, "");
  
  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
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


export async function checkConnection() {
  // Primeiro verificar localStorage para performance
  if (localStorage.getItem("wa_connected") === "true") {
    return { connected: true };
  }
  
  const url = EVO_CONFIG.getUrl();
  const key = EVO_CONFIG.getKey();
  const instance = EVO_CONFIG.getInstance();
  
  if (!url || !key) return { connected: false };
  
  const apiUrl = getApiUrl();
  
  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
      headers: { "apikey": key },
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.state === "open" || data.instance?.state === "open") {
        localStorage.setItem("wa_connected", "true");
        return { connected: true, phone: data.phoneNumber };
      }
    }
    localStorage.removeItem("wa_connected");
    return { connected: false };
  } catch {
    return { connected: false };
  }
}