import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Devolve um link utilizável para um documento.
 * - Arquivo no Storage (bucket privado "documentos"): URL assinada de 5 minutos.
 * - Outros links (ex.: Google Drive): devolve como está.
 * Para áreas restritas (RH, financeiro, certificado) confere usuario_tem_acesso.
 * GET /api/documento-url?id=<documento_id>&usuario=<usuario_id>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const id = String(req.query.id || '');
  const usuario = String(req.query.usuario || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'id inválido' });
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Servidor sem configuração do Supabase' });

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: doc, error } = await supabase
    .from('vw_documentos_cliente')
    .select('id, cliente_id, url, storage_path, restrito, area')
    .eq('id', id)
    .maybeSingle();
  if (error || !doc) return res.status(404).json({ error: 'Documento não encontrado' });

  if (doc.restrito) {
    if (!/^[0-9a-f-]{36}$/i.test(usuario)) return res.status(403).json({ error: 'Sem acesso' });
    const { data: ok } = await supabase.rpc('usuario_tem_acesso', {
      p_usuario: usuario,
      p_cliente: doc.cliente_id,
      p_area: doc.area,
    });
    if (!ok) return res.status(403).json({ error: 'Sem acesso a esta área' });
  }

  let path: string | null = doc.storage_path || null;
  if (!path && typeof doc.url === 'string' && doc.url.includes('/storage/v1/object/')) {
    // .../storage/v1/object/(public|authenticated|sign)?/<bucket>/<caminho>
    const resto = doc.url.split('/storage/v1/object/')[1].replace(/^(public|authenticated|sign)\//, '').split('?')[0];
    const [bucket, ...partes] = resto.split('/');
    if (bucket === 'documentos') path = decodeURIComponent(partes.join('/'));
  }

  if (path) {
    const { data: signed, error: signErr } = await supabase.storage.from('documentos').createSignedUrl(path, 300);
    if (signErr || !signed?.signedUrl) return res.status(500).json({ error: 'Não foi possível gerar o link' });
    return res.status(200).json({ url: signed.signedUrl, expira_em_segundos: 300 });
  }

  return res.status(200).json({ url: doc.url });
}
