/** Busca um link utilizável (assinado, se o arquivo estiver no Storage privado). */
export async function linkDoDocumento(documentoId: string, usuarioId?: string): Promise<string> {
  const qs = new URLSearchParams({ id: documentoId });
  if (usuarioId) qs.set("usuario", usuarioId);
  const res = await fetch(`/api/documento-url?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "Não foi possível abrir o documento");
  return data.url as string;
}

/** Abre o documento numa aba nova (abre a aba antes do fetch para não ser bloqueada). */
export async function abrirDocumento(documentoId: string, usuarioId?: string) {
  const aba = window.open("about:blank", "_blank");
  try {
    const url = await linkDoDocumento(documentoId, usuarioId);
    if (aba) aba.location.href = url;
    else window.open(url, "_blank", "noopener");
  } catch (e) {
    aba?.close();
    throw e;
  }
}
