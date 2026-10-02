/**
 * Endereços dos fluxos do n8n usados pelo app (fluxos em /n8n no repositório).
 * Base configurável por VITE_N8N_BASE_URL; os caminhos batem com os webhooks dos fluxos.
 */
const BASE = (import.meta.env.VITE_N8N_BASE_URL || "").replace(/\/$/, "");

/** false quando VITE_N8N_BASE_URL não foi definida na Vercel (automações indisponíveis). */
export const N8N_CONFIGURADO = BASE.startsWith("https://");

/**
 * Chama um fluxo do n8n passando pelo servidor do Conta+ (/api/proxy-webhook), que confere
 * o usuário e acrescenta a chave interna. O navegador nunca fala direto com o n8n.
 */
export async function chamarN8n<T = Record<string, unknown>>(
  url: string, usuarioId: string | undefined, payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T & { error?: string; message?: string } }> {
  if (!N8N_CONFIGURADO) {
    return { ok: false, status: 0, data: { error: "Automações não configuradas (VITE_N8N_BASE_URL)." } as never };
  }
  const res = await fetch("/api/proxy-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ targetUrl: url, usuario_id: usuarioId, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

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
