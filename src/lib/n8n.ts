/**
 * Endereços dos fluxos do n8n usados pelo app (fluxos em /n8n no repositório).
 * Base configurável por VITE_N8N_BASE_URL; os caminhos batem com os webhooks dos fluxos.
 */
const BASE = (import.meta.env.VITE_N8N_BASE_URL || "https://northway.vps8204.panel.icontainer.cloud").replace(/\/$/, "");

export const N8N = {
  /** 01 · Assistente IA interno */
  ia: `${BASE}/webhook/replypal/ia-pro`,
  /** 02 · Upload de documentos do cliente */
  documentosUpload: `${BASE}/webhook/documentos/upload`,
  /** 06 · Disparo de teste do relatório diário */
  relatorioTeste: `${BASE}/webhook/replypal/relatorio-atendimento/teste`,
  /** 07 · Eventos do sistema (cliente criado) */
  eventos: `${BASE}/webhook/conta/eventos`,
} as const;
