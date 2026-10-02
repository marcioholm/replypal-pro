import type { User, Customer } from "./store";
import { N8N, chamarN8n } from "./n8n";

async function sendWebhook(url: string, usuarioId: string | undefined, payload: Record<string, unknown>) {
  try {
    const res = await chamarN8n(url, usuarioId, { ...payload, source: "conta-mais", timestamp: new Date().toISOString() });
    if (!res.ok) console.error(`Webhook n8n (${res.status}):`, res.data?.error);
    return res.ok;
  } catch (error) {
    console.error("Erro ao chamar o n8n:", error);
    return false;
  }
}

// Eventos enviados ao fluxo 07 do n8n. Os demais eventos antigos (novo atendimento,
// mensagem enviada, mudança de etapa...) nunca eram disparados e foram removidos.
export const webhooks = {
  triggerCustomerCreated: (customer: Customer, creator?: User) => {
    // Cria a pasta do cliente no Google Drive do escritório (não faz nada se o Drive
    // não estiver conectado; se falhar, a pasta é criada no primeiro documento).
    if (creator?.id) {
      fetch("/api/google?action=pasta-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: customer.id, usuario_id: creator.id }),
      }).catch(() => undefined);
    }
    return sendWebhook(N8N.eventos, creator?.id, {
      event: "cliente_criado",
      tenant_id: customer.tenantId,
      cliente_id: customer.id,
      cliente_nome: customer.name,
      cnpj: customer.cnpj,
      criado_por: creator?.name,
    });
  },
};
