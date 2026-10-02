import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Google Drive do escritório (escopo drive.file: o Conta+ só enxerga o que ele criou).
 *
 *   GET  /api/google?action=iniciar&tenant=&usuario=   -> manda o admin para o consentimento do Google
 *   GET  /api/google?code=&state=                      -> volta do Google (redirect URI = /api/google)
 *   POST /api/google?action=desconectar                -> { tenant, usuario }
 *   POST /api/google?action=upload                     -> grava o documento no Drive e registra no banco
 *   POST /api/google?action=pasta-cliente              -> { cliente_id } cria a pasta do cliente
 *   GET  /api/google?action=arquivo&t=<token>          -> entrega o arquivo (link assinado, 5 min)
 *
 * Estrutura: Conta+/Clientes/<CNPJ - Nome>/<Área>/<AAAA-MM>/<arquivo>
 * Variáveis: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CONTA_SECRET, SUPABASE_URL,
 *            SUPABASE_SERVICE_ROLE_KEY e, opcional, APP_URL.
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceKey);

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const SEGREDO = process.env.CONTA_SECRET || '';

// Endereços do Google (trocáveis só para teste automatizado)
const AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_BASE = (process.env.GOOGLE_OAUTH_BASE || 'https://oauth2.googleapis.com').replace(/\/$/, '');
const API_BASE = (process.env.GOOGLE_API_BASE || 'https://www.googleapis.com').replace(/\/$/, '');

const ESCOPOS = 'openid email https://www.googleapis.com/auth/drive.file';
const PASTA = 'application/vnd.google-apps.folder';
const LIMITE_BYTES = 3 * 1024 * 1024; // corpo da requisição na Vercel: ~4,5 MB (base64 +33%)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Falha extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

// ── utilidades ────────────────────────────────────────────────────────────────
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const hmac = (txt: string) => createHmac('sha256', SEGREDO).update(txt).digest('base64url');
const igual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function assinar(dados: Record<string, unknown>): string {
  const corpo = b64u(JSON.stringify(dados));
  return `${corpo}.${hmac(corpo)}`;
}
function conferir<T = any>(token: string): T | null {
  const [corpo, assinatura] = String(token || '').split('.');
  if (!corpo || !assinatura || !igual(assinatura, hmac(corpo))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!dados.e || Date.now() > dados.e) return null;
    return dados as T;
  } catch { return null; }
}

const chave = () => createHash('sha256').update(SEGREDO).digest();
function cifrar(txt: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(), iv);
  const ct = Buffer.concat([c.update(txt, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function decifrar(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', chave(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

function baseDoApp(req: VercelRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return `${proto}://${host}`;
}
const redirectUri = (req: VercelRequest) => `${baseDoApp(req)}/api/google`;

async function usuarioDoTenant(usuario: string, tenant: string, exigirAdmin: boolean) {
  if (!UUID.test(usuario) || !UUID.test(tenant)) throw new Falha(400, 'Dados inválidos');
  const { data } = await supabase.from('usuarios').select('id, role, tenant_id').eq('id', usuario).maybeSingle();
  if (!data || data.tenant_id !== tenant) throw new Falha(403, 'Usuário não pertence a este escritório');
  if (exigirAdmin && data.role !== 'admin') throw new Falha(403, 'Apenas administradores podem alterar a integração');
  return data;
}

// ── Google ───────────────────────────────────────────────────────────────────
const tokensEmMemoria = new Map<string, { token: string; expira: number }>();

async function trocarToken(params: Record<string, string>) {
  const r = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }).toString(),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Falha(502, `Google recusou a autorização (${j.error || r.status})`);
  return j;
}

async function registrarErro(tenant: string, msg: string | null) {
  await supabase.from('integracoes_google')
    .update({ ultimo_erro: msg, ultimo_erro_em: msg ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenant);
}

async function tokenDeAcesso(tenant: string): Promise<{ token: string; conexao: any } | null> {
  const { data: conexao } = await supabase.from('integracoes_google').select('*').eq('tenant_id', tenant).maybeSingle();
  if (!conexao || !conexao.ativo) return null;
  const guardado = tokensEmMemoria.get(tenant);
  if (guardado && guardado.expira > Date.now() + 60_000) return { token: guardado.token, conexao };
  try {
    const j = await trocarToken({ grant_type: 'refresh_token', refresh_token: decifrar(conexao.refresh_token_cifrado) });
    tokensEmMemoria.set(tenant, { token: j.access_token, expira: Date.now() + (j.expires_in || 3000) * 1000 });
    if (conexao.ultimo_erro) await registrarErro(tenant, null);
    return { token: j.access_token, conexao };
  } catch (e: any) {
    // invalid_grant = o escritório removeu o acesso do Conta+ na conta Google
    await registrarErro(tenant, 'O Google recusou o acesso. Conecte o Drive de novo em Configurações.');
    throw new Falha(502, 'O Google Drive do escritório precisa ser conectado de novo.');
  }
}

async function drive(token: string, caminho: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
}

async function pastaExiste(token: string, id: string): Promise<boolean> {
  const r = await drive(token, `/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed,mimeType`);
  if (!r.ok) return false;
  const j: any = await r.json().catch(() => ({}));
  return !j.trashed;
}

async function criarPasta(token: string, nome: string, pai?: string): Promise<string> {
  const r = await drive(token, '/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: PASTA, ...(pai ? { parents: [pai] } : {}) }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Falha(r.status === 404 ? 404 : 502, `Não foi possível criar a pasta "${nome}" no Drive`);
  return j.id;
}

/** Devolve o id da pasta guardada para a chave; cria (e guarda) se ainda não existe. */
async function garantirPasta(token: string, tenant: string, chavePasta: string, nome: string, pai: string, conferirNoDrive = false): Promise<string> {
  const { data: ja } = await supabase.from('drive_pastas').select('pasta_id')
    .eq('tenant_id', tenant).eq('chave', chavePasta).maybeSingle();
  if (ja?.pasta_id) {
    if (!conferirNoDrive || await pastaExiste(token, ja.pasta_id)) return ja.pasta_id;
    // A pasta foi apagada (ou está na lixeira): esquece ela e tudo que estava dentro.
    await supabase.from('drive_pastas').delete().eq('tenant_id', tenant).like('chave', `${chavePasta}%`);
  }
  const id = await criarPasta(token, nome, pai);
  const { error } = await supabase.from('drive_pastas').insert({ tenant_id: tenant, chave: chavePasta, pasta_id: id, nome });
  if (error) {
    // Outra requisição criou ao mesmo tempo: fica valendo a que já está no banco.
    const { data: outra } = await supabase.from('drive_pastas').select('pasta_id')
      .eq('tenant_id', tenant).eq('chave', chavePasta).maybeSingle();
    if (outra?.pasta_id) return outra.pasta_id;
  }
  return id;
}

/** Garante Conta+/Clientes. Recria se o escritório apagou as pastas no Drive. */
async function garantirRaiz(token: string, conexao: any): Promise<string> {
  if (conexao.pasta_clientes_id && await pastaExiste(token, conexao.pasta_clientes_id)) return conexao.pasta_clientes_id;
  let raiz = conexao.pasta_raiz_id;
  if (!raiz || !(await pastaExiste(token, raiz))) raiz = await criarPasta(token, 'Conta+');
  const clientes = await criarPasta(token, 'Clientes', raiz);
  await supabase.from('drive_pastas').delete().eq('tenant_id', conexao.tenant_id); // filhas da raiz antiga
  await supabase.from('integracoes_google')
    .update({ pasta_raiz_id: raiz, pasta_clientes_id: clientes, updated_at: new Date().toISOString() })
    .eq('tenant_id', conexao.tenant_id);
  conexao.pasta_raiz_id = raiz; conexao.pasta_clientes_id = clientes;
  return clientes;
}

/**
 * Pasta onde o documento vai. No caminho normal confia nos ids guardados e só confere a
 * última pasta (o Drive marca "trashed" também quando uma pasta acima foi para a lixeira).
 * Se ela sumiu, refaz conferindo nível por nível e recria só o que falta.
 */
async function pastaDoDocumento(token: string, conexao: any, clienteId: string, destino: any): Promise<string> {
  const tenant = conexao.tenant_id;
  const raiz = await garantirRaiz(token, conexao);
  const montar = async (conferir: boolean) => {
    let pai = await garantirPasta(token, tenant, `cliente:${clienteId}`, destino.pasta_cliente, raiz, conferir);
    if (destino.pasta_area) {
      pai = await garantirPasta(token, tenant, `cliente:${clienteId}/${destino.pasta_area}`, destino.pasta_area, pai, conferir);
      if (destino.pasta_mes) {
        pai = await garantirPasta(token, tenant, `cliente:${clienteId}/${destino.pasta_area}/${destino.pasta_mes}`, destino.pasta_mes, pai, conferir);
      }
    }
    return pai;
  };
  try {
    const pasta = await montar(false);
    if (await pastaExiste(token, pasta)) return pasta;
  } catch (e) {
    if (!(e instanceof Falha) || e.status !== 404) throw e; // 404 = pasta acima foi apagada
  }
  return montar(true);
}

async function enviarArquivo(token: string, pasta: string, nome: string, mime: string, conteudo: Buffer) {
  const limite = `contamais${randomBytes(12).toString('hex')}`;
  const corpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [pasta] })}\r\n`),
    Buffer.from(`--${limite}\r\nContent-Type: ${mime}\r\n\r\n`),
    conteudo,
    Buffer.from(`\r\n--${limite}--`),
  ]);
  const r = await drive(token, '/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
    body: corpo,
  });
  const j: any = await r.json().catch(() => ({}));
  return { ok: r.ok && !!j.id, status: r.status, id: j.id as string, link: j.webViewLink as string, erro: j.error?.message as string };
}

// ── ações ────────────────────────────────────────────────────────────────────
async function iniciar(req: VercelRequest, res: VercelResponse) {
  const tenant = String(req.query.tenant || ''), usuario = String(req.query.usuario || '');
  await usuarioDoTenant(usuario, tenant, true);
  const state = assinar({ t: tenant, u: usuario, e: Date.now() + 10 * 60_000 });
  const qs = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: redirectUri(req), response_type: 'code', scope: ESCOPOS,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state,
  });
  res.writeHead(302, { Location: `${AUTH_URL}?${qs.toString()}` });
  return res.end();
}

async function callback(req: VercelRequest, res: VercelResponse) {
  const voltar = (q: string) => { res.writeHead(302, { Location: `${baseDoApp(req)}/settings?${q}` }); return res.end(); };
  const st = conferir<{ t: string; u: string }>(String(req.query.state || ''));
  if (!st) return voltar('drive=erro&motivo=sessao');
  if (req.query.error) return voltar('drive=erro&motivo=negado');
  try {
    await usuarioDoTenant(st.u, st.t, true);
    const j = await trocarToken({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: redirectUri(req) });
    if (!String(j.scope || '').includes('drive.file')) return voltar('drive=erro&motivo=permissao');
    if (!j.refresh_token) return voltar('drive=erro&motivo=token');

    let email: string | null = null;
    try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email || null; } catch { /* sem e-mail */ }

    const { data: antiga } = await supabase.from('integracoes_google').select('*').eq('tenant_id', st.t).maybeSingle();
    const mesmaConta = !!antiga && !!email && antiga.google_email === email;
    if (antiga && !mesmaConta) await supabase.from('drive_pastas').delete().eq('tenant_id', st.t); // pastas eram da outra conta

    const conexao: any = {
      tenant_id: st.t, google_email: email, refresh_token_cifrado: cifrar(j.refresh_token), ativo: true,
      pasta_raiz_id: mesmaConta ? antiga.pasta_raiz_id : null,
      pasta_clientes_id: mesmaConta ? antiga.pasta_clientes_id : null,
      conectado_por: st.u, conectado_em: new Date().toISOString(),
      ultimo_erro: null, ultimo_erro_em: null, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('integracoes_google').upsert(conexao, { onConflict: 'tenant_id' });
    if (error) throw new Falha(500, error.message);

    tokensEmMemoria.set(st.t, { token: j.access_token, expira: Date.now() + (j.expires_in || 3000) * 1000 });
    await garantirRaiz(j.access_token, conexao); // já deixa Conta+/Clientes criadas
    return voltar('drive=ok');
  } catch (e: any) {
    console.error('[google] callback:', e?.message);
    return voltar('drive=erro&motivo=falha');
  }
}

async function desconectar(req: VercelRequest, res: VercelResponse) {
  const { tenant, usuario } = req.body || {};
  await usuarioDoTenant(String(usuario || ''), String(tenant || ''), true);
  const { data: conexao } = await supabase.from('integracoes_google').select('refresh_token_cifrado, ativo').eq('tenant_id', tenant).maybeSingle();
  if (conexao?.ativo && conexao.refresh_token_cifrado) {
    try {
      await fetch(`${OAUTH_BASE}/revoke`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: decifrar(conexao.refresh_token_cifrado) }).toString(),
      });
    } catch { /* se o Google não responder, remove do nosso lado mesmo assim */ }
  }
  // Apaga o token, mas guarda e-mail e pastas: reconectando a mesma conta, o Conta+
  // continua nas mesmas pastas em vez de criar uma segunda "Conta+".
  await supabase.from('integracoes_google')
    .update({ ativo: false, refresh_token_cifrado: '', ultimo_erro: null, ultimo_erro_em: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenant);
  tokensEmMemoria.delete(tenant);
  return res.status(200).json({ success: true });
}

async function upload(req: VercelRequest, res: VercelResponse) {
  const b = req.body || {};
  const clienteId = String(b.cliente_id || '');
  if (!UUID.test(clienteId)) throw new Falha(400, 'cliente_id inválido');
  if (!b.tipo) throw new Falha(400, 'Informe o tipo do documento');
  const base64 = String(b.arquivo_base64 || '').replace(/^data:[^,]*,/, '');
  if (!base64) throw new Falha(400, 'Arquivo não enviado');
  const conteudo = Buffer.from(base64, 'base64');
  if (conteudo.length > LIMITE_BYTES) throw new Falha(413, 'Arquivo maior que 3 MB');

  const mes = b.mes ? Number(b.mes) : null, ano = b.ano ? Number(b.ano) : null;
  const { data: destino } = await supabase.rpc('drive_destino', {
    p_cliente: clienteId, p_categoria: b.categoria || 'Geral', p_tipo: b.tipo, p_mes: mes, p_ano: ano,
  });
  if (!destino) throw new Falha(404, 'Cliente não encontrado');
  await usuarioDoTenant(String(b.usuario_id || ''), destino.tenant_id, false);

  // Certificado (e qualquer área sem pasta) fica no Storage privado; sem Drive conectado também.
  if (!destino.vai_para_drive) return res.status(200).json({ success: false, fallback: true, motivo: 'area_fora_do_drive' });
  const acesso = await tokenDeAcesso(destino.tenant_id);
  if (!acesso) return res.status(200).json({ success: false, fallback: true, motivo: 'drive_nao_conectado' });

  const nome = String(b.arquivo_nome || 'arquivo').replace(/[\\/]+/g, '-').slice(-150);
  const mime = String(b.arquivo_tipo || 'application/octet-stream');

  const pasta = await pastaDoDocumento(acesso.token, acesso.conexao, clienteId, destino);
  const envio = await enviarArquivo(acesso.token, pasta, nome, mime, conteudo);
  if (!envio.ok) {
    const cheio = /storage|quota/i.test(envio.erro || '');
    const msg = cheio ? 'O Google Drive do escritório está sem espaço.' : `O Drive recusou o arquivo (${envio.status}).`;
    await registrarErro(destino.tenant_id, msg);
    throw new Falha(502, msg);
  }

  const { data: doc, error } = await supabase.from('documentos').insert({
    cliente_id: clienteId, tenant_id: destino.tenant_id, categoria: b.categoria || 'Geral', tipo: b.tipo,
    mes, ano, url: envio.link || `https://drive.google.com/file/d/${envio.id}/view`,
    drive_file_id: envio.id, nome_arquivo: nome, mime_type: mime, tamanho_bytes: conteudo.length,
    uploaded_by: b.uploaded_by || null, vigente: b.vigente !== false, uploaded_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw new Falha(500, `Arquivo gravado no Drive, mas não foi registrado: ${error.message}`);

  return res.status(200).json({ success: true, id: doc.id, destino: 'drive' });
}

async function pastaCliente(req: VercelRequest, res: VercelResponse) {
  const clienteId = String(req.body?.cliente_id || '');
  if (!UUID.test(clienteId)) throw new Falha(400, 'cliente_id inválido');
  const { data: destino } = await supabase.rpc('drive_destino', {
    p_cliente: clienteId, p_categoria: 'Geral', p_tipo: 'outros', p_mes: null, p_ano: null,
  });
  if (!destino) throw new Falha(404, 'Cliente não encontrado');
  await usuarioDoTenant(String(req.body?.usuario_id || ''), destino.tenant_id, false);
  const acesso = await tokenDeAcesso(destino.tenant_id);
  if (!acesso) return res.status(200).json({ success: true, criada: false, motivo: 'drive_nao_conectado' });
  const raiz = await garantirRaiz(acesso.token, acesso.conexao);
  const id = await garantirPasta(acesso.token, destino.tenant_id, `cliente:${clienteId}`, destino.pasta_cliente, raiz);
  return res.status(200).json({ success: true, criada: true, pasta_id: id });
}

async function arquivo(req: VercelRequest, res: VercelResponse) {
  const t = conferir<{ d: string }>(String(req.query.t || ''));
  if (!t) return res.status(403).send('Link expirado. Abra o documento de novo pelo Conta+.');
  const { data: doc } = await supabase.from('documentos')
    .select('tenant_id, drive_file_id, nome_arquivo, mime_type').eq('id', t.d).maybeSingle();
  if (!doc?.drive_file_id) return res.status(404).send('Documento não encontrado.');
  const acesso = await tokenDeAcesso(doc.tenant_id);
  if (!acesso) return res.status(409).send('O Google Drive do escritório não está conectado.');
  const r = await drive(acesso.token, `/drive/v3/files/${encodeURIComponent(doc.drive_file_id)}?alt=media`);
  if (!r.ok) {
    return res.status(r.status === 404 ? 404 : 502)
      .send(r.status === 404 ? 'Arquivo não encontrado no Drive (pode ter sido apagado).' : 'O Drive não entregou o arquivo.');
  }
  const conteudo = Buffer.from(await r.arrayBuffer());
  const nome = String(doc.nome_arquivo || 'documento').replace(/["\r\n]/g, '');
  res.setHeader('Content-Type', doc.mime_type || r.headers.get('content-type') || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nome)}"; filename*=UTF-8''${encodeURIComponent(nome)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(conteudo);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabaseUrl || !serviceKey) throw new Falha(500, 'Servidor sem configuração do Supabase');
    if (!SEGREDO || SEGREDO.length < 24) throw new Falha(500, 'Defina CONTA_SECRET (24+ caracteres) na Vercel');

    if (!CLIENT_ID || !CLIENT_SECRET) throw new Falha(500, 'Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel');

    const action = String(req.query.action || '');
    if (req.method === 'GET' && action === 'arquivo') return await arquivo(req, res);

    if (req.method === 'GET' && !action && req.query.state) return await callback(req, res);
    if (req.method === 'GET' && action === 'iniciar') return await iniciar(req, res);
    if (req.method === 'POST' && action === 'desconectar') return await desconectar(req, res);
    if (req.method === 'POST' && action === 'upload') return await upload(req, res);
    if (req.method === 'POST' && action === 'pasta-cliente') return await pastaCliente(req, res);
    return res.status(404).json({ success: false, error: 'Ação desconhecida' });
  } catch (e: any) {
    const status = e instanceof Falha ? e.status : 500;
    if (!(e instanceof Falha)) console.error('[google]', e);
    return res.status(status).json({ success: false, error: e?.message || 'Erro interno' });
  }
}
