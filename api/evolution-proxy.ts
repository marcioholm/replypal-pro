import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Repassa chamadas do app para a Evolution quando o navegador é bloqueado (CORS / rede).
 *
 * Só repassa para servidores da Evolution cadastrados em Configurações (company_settings).
 * Sem essa trava, qualquer pessoa na internet podia usar este endereço para fazer a Vercel
 * chamar qualquer URL em nome do Conta+.
 */
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const METODOS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
let hostsEmMemoria: { hosts: Set<string>; expira: number } | null = null;

function hostDe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    return u.host.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts de Evolution cadastrados por algum escritório (guardado por 60 s). */
async function hostsPermitidos(): Promise<Set<string>> {
  if (hostsEmMemoria && hostsEmMemoria.expira > Date.now()) return hostsEmMemoria.hosts;
  const hosts = new Set<string>();
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data } = await supabase.from('company_settings').select('evolution_url').not('evolution_url', 'is', null);
  for (const linha of data || []) {
    const h = hostDe(linha.evolution_url);
    if (h) hosts.add(h);
  }
  hostsEmMemoria = { hosts, expira: Date.now() + 60_000 };
  return hosts;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Servidor sem configuração do Supabase' });
  }

  const { targetUrl, headers = {}, method = 'GET', body } = req.body || {};
  if (!targetUrl) {
    return res.status(400).json({ error: 'targetUrl is required' });
  }

  let alvo: URL;
  try {
    alvo = new URL(String(targetUrl));
  } catch {
    return res.status(400).json({ error: 'targetUrl inválida' });
  }
  const metodo = String(method).toUpperCase();
  if (!METODOS.has(metodo)) {
    return res.status(400).json({ error: 'Método não permitido' });
  }
  if (alvo.protocol !== 'https:') {
    return res.status(403).json({ error: 'A Evolution precisa usar https' });
  }

  let permitidos = await hostsPermitidos();
  if (!permitidos.has(alvo.host.toLowerCase())) {
    // Pode ser uma Evolution que acabou de ser salva: confere de novo sem a memória.
    hostsEmMemoria = null;
    permitidos = await hostsPermitidos();
  }
  if (!permitidos.has(alvo.host.toLowerCase())) {
    return res.status(403).json({ error: 'Servidor não cadastrado como Evolution de nenhum escritório. Salve a URL em Configurações antes.' });
  }

  // Só os cabeçalhos que a Evolution usa
  const repassar: Record<string, string> = { 'Content-Type': 'application/json' };
  if (headers && typeof headers === 'object' && typeof (headers as any).apikey === 'string') {
    repassar.apikey = (headers as any).apikey;
  }

  try {
    const fetchOptions: RequestInit = { method: metodo, headers: repassar, signal: AbortSignal.timeout(25_000) };
    if (body && metodo !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(alvo.toString(), fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (error: any) {
    console.error('[EvolutionProxy] Erro ao redirecionar chamada:', error);
    return res.status(502).json({
      error: 'Proxy Error',
      message: error.message || String(error),
    });
  }
}
