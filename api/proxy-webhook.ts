import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Porta única do app para os webhooks do n8n.
 *
 * - Só repassa para o n8n configurado (N8N_BASE_URL / VITE_N8N_BASE_URL / N8N_ALLOWED_HOSTS).
 * - Confere que quem chama é um usuário do escritório e força o tenant_id dele no envio.
 * - Acrescenta a chave interna (x-conta-key): os webhooks do n8n recusam chamadas sem ela,
 *   então ninguém consegue falar com os fluxos direto pela internet.
 */
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  (process.env.N8N_ALLOWED_HOSTS || '')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean)
    .forEach(h => hosts.add(h));
  for (const key of ['N8N_BASE_URL', 'VITE_N8N_BASE_URL']) {
    try {
      const v = process.env[key];
      if (v) hosts.add(new URL(v).host);
    } catch {
      /* variável mal formatada: ignora */
    }
  }
  return hosts;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { targetUrl, usuario_id, ...payload } = req.body || {};

  if (!targetUrl) {
    return res.status(400).json({ error: 'Target URL is required' });
  }
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid target URL' });
  }
  const hosts = allowedHosts();
  if (hosts.size === 0) {
    return res.status(500).json({ error: 'n8n não configurado: defina VITE_N8N_BASE_URL na Vercel' });
  }
  if (target.protocol !== 'https:' || !hosts.has(target.host)) {
    return res.status(403).json({ error: 'Target host not allowed' });
  }

  const chave = process.env.CONTA_INTERNAL_KEY || '';
  if (chave.length < 24) {
    return res.status(500).json({ error: 'Defina CONTA_INTERNAL_KEY (24+ caracteres) na Vercel' });
  }
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Servidor sem configuração do Supabase' });
  }

  // Quem está chamando? Precisa ser um usuário real; o tenant_id enviado ao n8n é o dele.
  if (!UUID.test(String(usuario_id || ''))) {
    return res.status(401).json({ error: 'Sessão inválida. Entre de novo no Conta+.' });
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: usuario } = await supabase
    .from('usuarios').select('id, tenant_id').eq('id', usuario_id).maybeSingle();
  if (!usuario?.tenant_id) {
    return res.status(401).json({ error: 'Sessão inválida. Entre de novo no Conta+.' });
  }
  if (payload.tenant_id && payload.tenant_id !== usuario.tenant_id) {
    return res.status(403).json({ error: 'Escritório diferente do usuário' });
  }
  if (payload.cliente_id && UUID.test(String(payload.cliente_id))) {
    const { data: cliente } = await supabase
      .from('clientes').select('tenant_id').eq('id', payload.cliente_id).maybeSingle();
    if (cliente && cliente.tenant_id !== usuario.tenant_id) {
      return res.status(403).json({ error: 'Cliente de outro escritório' });
    }
  }
  payload.tenant_id = usuario.tenant_id;

  try {
    const response = await fetch(target.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-conta-key': chave,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(28_000),
    });

    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { message: data };
    }
    if (response.status === 401 || response.status === 403) {
      return res.status(502).json({ error: 'O n8n recusou a chave interna. Confira a credencial "Conta+ · API interna".' });
    }
    return res.status(response.status).json(jsonData);
  } catch (error) {
    console.error('Error in proxy webhook:', error);
    const demorou = error instanceof Error && error.name === 'TimeoutError';
    return res.status(demorou ? 504 : 502).json({
      error: demorou ? 'O n8n demorou para responder' : 'Não foi possível falar com o n8n',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
