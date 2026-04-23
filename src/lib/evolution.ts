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
  let url = localStorage.getItem("evolution_url") || "";
  const key = localStorage.getItem("evolution_key") || "";
  const instance = localStorage.getItem("evolution_instance") || "replypal";
  
  if (!url || !key) return { success: false, error: "API não configurada" };
  
  url = url.trim();
  if (!url.startsWith("http")) url = "https://" + url;
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
    return { success: false, error: "Erro ao enviar" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function checkConnection() {
  const savedUrl = localStorage.getItem("evolution_url");
  const savedKey = localStorage.getItem("evolution_key");
  const savedInstance = localStorage.getItem("evolution_instance");
  
  // Primeiro verificar localStorage
  if (localStorage.getItem("wa_connected") === "true") {
    return { connected: true };
  }
  
  let url = savedUrl || "";
  const key = savedKey || "";
  const instance = savedInstance || "SASAKI";
  
  if (!url || !key) return { connected: false };
  
  url = url.trim();
  if (!url.startsWith("http")) url = "https://" + url;
  
  try {
    const res = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { "apikey": key },
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.state === "open") {
        localStorage.setItem("wa_connected", "true");
        return { connected: true, phone: data.phoneNumber };
      }
    }
    return { connected: false };
  } catch {
    return { connected: false };
  }
}