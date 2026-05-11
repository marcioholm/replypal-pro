import { User, Conversation, Customer } from "./store";

const N8N_URLS = {
  financeiro: import.meta.env.VITE_N8N_FINANCEIRO_WEBHOOK || "",
  documentos: "https://northway.vps8204.panel.icontainer.cloud/webhook/documentos/upload",
  // Endpoint para eventos operacionais do sistema
  eventos: import.meta.env.VITE_N8N_IA_WEBHOOK || "", 
};

async function sendWebhook(url: string, payload: any) {
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
        source: "replypal-pro",
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

export const webhooks = {
  // 1. Novo Atendimento
  triggerNewService: (conversation: Conversation) => 
    sendWebhook(N8N_URLS.eventos, { event: "novo_atendimento", conversation }),

  // 2. Mensagem Recebida (Geralmente o n8n ou Evolution já pega isso, mas aqui para redundância se necessário)
  triggerMessageReceived: (message: any) => 
    sendWebhook(N8N_URLS.eventos, { event: "mensagem_recebida", message }),

  // 3. Mensagem Enviada
  triggerMessageSent: (message: any, conversation: Conversation, agent?: User) => 
    sendWebhook(N8N_URLS.eventos, { event: "mensagem_enviada", message, conversation, agent }),

  // 4. Mudança de Etapa (Kanban/Status)
  triggerStageChange: (conversation: Conversation, oldStatus: string, newStatus: string, agent: User) => 
    sendWebhook(N8N_URLS.eventos, { event: "mudanca_etapa", conversation, oldStatus, newStatus, agent }),

  // 5. Cliente Criado
  triggerCustomerCreated: (customer: Customer, creator?: User) => 
    sendWebhook(N8N_URLS.eventos, { event: "cliente_criado", customer, creator }),

  // 6. Atendimento Finalizado
  triggerServiceFinished: (conversation: Conversation, agent: User, reason?: string) => 
    sendWebhook(N8N_URLS.eventos, { event: "atendimento_finalizado", conversation, agent, reason }),

  // 7. Transferência de Responsável
  triggerTransferOwner: (conversation: Conversation, fromAgent: User, toAgentName: string, reason?: string) => 
    sendWebhook(N8N_URLS.eventos, { event: "transferencia_responsavel", conversation, fromAgent, toAgentName, reason }),
  
  // 8. Financeiro (Específico)
  triggerFinancialData: (data: any) => 
    sendWebhook(N8N_URLS.financeiro, { event: "dados_financeiros", ...data }),
};
