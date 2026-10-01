import type { User, Customer } from "./store";
import { N8N } from "./n8n";

async function sendWebhook(url: string, payload: Record<string, unknown>) {
  if (!url) {
    console.warn("Webhook URL not configured for this event.");
    return;
  }

  try {
    // Usar Proxy interno para evitar CORS em todos os webhooks do sistema
    const response = await fetch("/api/proxy-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUrl: url,
        ...payload,
        source: "conta-mais",
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      console.error(`Webhook Proxy Error (${response.status})`);
    }
    
    return response.ok;
  } catch (error) {
    console.error("Error sending webhook via proxy:", error);
    return false;
  }
}

// Eventos enviados ao fluxo 07 do n8n. Os demais eventos antigos (novo atendimento,
// mensagem enviada, mudança de etapa...) nunca eram disparados e foram removidos.
export const webhooks = {
  triggerCustomerCreated: (customer: Customer, creator?: User) =>
    sendWebhook(N8N.eventos, {
      event: "cliente_criado",
      tenant_id: customer.tenantId,
      cliente_id: customer.id,
      cliente_nome: customer.name,
      cnpj: customer.cnpj,
      criado_por: creator?.name,
    }),
};
