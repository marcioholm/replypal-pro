import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Devolve um link utilizável para um documento.
 * - Arquivo no Storage (bucket privado "documentos"): URL assinada de 5 minutos.
 * - Outros links (ex.: Google Drive): devolve como está.
 * - Arquivo no Google Drive do escritório: link assinado de 5 minutos para /api/google,
 *   que entrega o arquivo sem exigir login no Google (serve para abrir e para o WhatsApp).
 * Para áreas restritas (RH, financeiro, certificado) confere usuario_tem_acesso.
 * GET /api/documento-url?id=<documento_id>&usuario=<usuario_id>
 *
 * Automação (n8n): cabeçalho x-conta-key = CONTA_INTERNAL_KEY dispensa o usuário;
 * as regras de quem pode receber o quê já foram decididas no banco antes de chegar aqui.
 */
function chamadaInterna(req: VercelRequest): boolean {
  const esperado = process.env.CONTA_INTERNAL_KEY || '';
  const recebido = String(req.headers['x-conta-key'] || '');
  if (esperado.length < 24 || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

function linkDoDrive(req: VercelRequest, documentoId: string): string | null {
  const segredo = process.env.CONTA_SECRET || '';
  if (segredo.length < 24) return null;
  const corpo = Buffer.from(JSON.stringify({ d: documentoId, e: Date.now() + 5 * 60_000 })).toString('base64url');
  const assinatura = createHmac('sha256', segredo).update(corpo).digest('base64url');
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const base = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');
  return `${base}/api/google?action=arquivo&t=${corpo}.${assinatura}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const id = String(req.query.id || '');
  const usuario = String(req.query.usuario || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'id inválido' });
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Servidor sem configuração do Supabase' });

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: doc, error } = await supabase
    .from('vw_documentos_cliente')
    .select('id, cliente_id, tenant_id, url, storage_path, drive_file_id, nome_arquivo, mime_type, restrito, area')
    .eq('id', id)
    .maybeSingle();
  if (error || !doc) return res.status(404).json({ error: 'Documento não encontrado' });

  if (doc.restrito && !chamadaInterna(req)) {
    if (!/^[0-9a-f-]{36}$/i.test(usuario)) return res.status(403).json({ error: 'Sem acesso' });
    const { data: ok } = await supabase.rpc('usuario_tem_acesso', {
      p_usuario: usuario,
      p_cliente: doc.cliente_id,
      p_area: doc.area,
    });
    if (!ok) return res.status(403).json({ error: 'Sem acesso a esta área' });
  }

  if (doc.drive_file_id) {
    // Sem o Drive conectado o link não abriria: avisa agora, em vez de mandar um link morto.
    const { data: drive } = await supabase.from('integracoes_google')
      .select('ativo').eq('tenant_id', doc.tenant_id).maybeSingle();
    if (!drive?.ativo) {
      return res.status(409).json({ error: 'O Google Drive do escritório não está conectado. Conecte em Configurações.' });
    }
    const link = linkDoDrive(req, doc.id);
    if (!link) return res.status(500).json({ error: 'Defina CONTA_SECRET na Vercel' });
    return res.status(200).json({
      url: link, expira_em_segundos: 300, origem: 'drive',
      nome_arquivo: doc.nome_arquivo, mime_type: doc.mime_type,
    });
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
