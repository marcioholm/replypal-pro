import { supabase } from "./supabase";

export interface WhatsappCheckResult {
  phone: string;
  exists: boolean | null;
  status: "possui WhatsApp" | "não possui WhatsApp" | "erro na verificação";
  checked_at: string;
  provider: string;
  error?: string;
}

/**
 * Verifica se um número possui conta ativa no WhatsApp.
 * Esta função está preparada para integração com Evolution API.
 */
export async function checkWhatsappNumber(phone: string, evolutionConfig?: { url: string; key: string; instance: string }): Promise<WhatsappCheckResult> {
  const normalized = phone.replace(/\D/g, "");
  const fullPhone = normalized.startsWith("55") ? normalized : "55" + normalized;
  const checkedAt = new Date().toISOString();
  const provider = "evolution_api";

  // 1. Se não houver configuração, usamos o modo MOCK para demonstração
  if (!evolutionConfig || !evolutionConfig.url || !evolutionConfig.key) {
    await new Promise(resolve => setTimeout(resolve, 600)); // Simular latência
    
    // Regra de mock para demonstração: números terminados em 0 não tem zap
    const exists = !fullPhone.endsWith("0");
    
    return {
      phone: fullPhone,
      exists,
      status: exists ? "possui WhatsApp" : "não possui WhatsApp",
      checked_at: checkedAt,
      provider: provider + "_mock"
    };
  }

  // 2. Implementação real (preparada)
  try {
    const response = await fetch(`${evolutionConfig.url}/chat/checkNumber/${evolutionConfig.instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.key
      },
      body: JSON.stringify({
        numbers: [fullPhone]
      })
    });

    if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);

    const data = await response.json();
    // A Evolution API geralmente retorna um array de objetos com { number, exists }
    const result = Array.isArray(data) ? data[0] : data;
    const exists = result?.exists || false;

    return {
      phone: fullPhone,
      exists,
      status: exists ? "possui WhatsApp" : "não possui WhatsApp",
      checked_at: checkedAt,
      provider
    };
  } catch (error: any) {
    console.error("Erro ao verificar WhatsApp:", error);
    return {
      phone: fullPhone,
      exists: null,
      status: "erro na verificação",
      error: error.message,
      checked_at: checkedAt,
      provider
    };
  }
}
