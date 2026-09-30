import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { phone: inputPhone, tenantId } = req.body || {};
  if (!inputPhone || !tenantId) {
    return res.status(400).json({ error: 'phone e tenantId obrigatorios' });
  }

  const { data: cfg } = await supabase
    .from('company_settings')
    .select('evolution_url, evolution_api_key, instance_name')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const evoUrl = (cfg?.evolution_url || process.env.EVOLUTION_URL || "").replace(/\/+$/, "");
  const apiKey = cfg?.evolution_api_key || process.env.EVOLUTION_API_KEY || "";
  const instance = cfg?.instance_name || process.env.INSTANCE_NAME || process.env.VITE_INSTANCE_NAME || "SASAKI";

  if (!evoUrl || !apiKey) {
    return res.status(400).json({ error: 'Evolution API nao configurada' });
  }

  // Gerar todas as variacoes possiveis do numero
  const digits = inputPhone.replace(/\D/g, '');
  const variations = [
    { label: 'digits_originais', value: digits },
    { label: 'com_55', value: digits.startsWith('55') ? digits : '55' + digits },
    { label: 'sem_55', value: digits.startsWith('55') ? digits.substring(2) : digits },
    { label: 'sem_nono_digito', value: digits.startsWith('55') && digits.length === 13 ? digits.substring(0, 4) + digits.substring(5) : digits },
    { label: 'jid_completo', value: `${digits}@s.whatsapp.net` },
    { label: 'telefone_formatado', value: digits },
  ];

  const results: any[] = [];

  for (const v of variations) {
    // Tentar POST com body { number }
    try {
      const resp = await fetch(`${evoUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ number: v.value })
      });
      const body = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = body; }
      results.push({
        variacao: v.label,
        numero_enviado: v.value,
        method: 'POST',
        status: resp.status,
        response: typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 300) : String(parsed).substring(0, 300),
        tem_foto: !!(parsed?.profilePictureUrl || parsed?.url || parsed?.imgUrl)
      });
    } catch (e: any) {
      results.push({
        variacao: v.label,
        numero_enviado: v.value,
        method: 'POST',
        status: 'EXCEPTION',
        response: e.message
      });
    }

    // Tentar GET /chat/fetchProfilePictureUrl/{instance}/{number}
    try {
      const resp = await fetch(`${evoUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}/${encodeURIComponent(v.value)}`, {
        method: 'GET',
        headers: { 'apikey': apiKey }
      });
      const body = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = body; }
      results.push({
        variacao: v.label + '_GET',
        numero_enviado: `path param: ${v.value}`,
        method: 'GET',
        status: resp.status,
        response: typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 300) : String(parsed).substring(0, 300),
        tem_foto: !!(parsed?.profilePictureUrl || parsed?.url || parsed?.imgUrl)
      });
    } catch (e: any) {
      results.push({
        variacao: v.label + '_GET',
        numero_enviado: `path param: ${v.value}`,
        method: 'GET',
        status: 'EXCEPTION',
        response: e.message
      });
    }
  }

  // Tentar POST com outros formatos de body
  const extraBodies = ['number', 'phone', 'jid', 'remoteJid', 'id'];
  for (const key of extraBodies) {
    try {
      const resp = await fetch(`${evoUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ [key]: digits })
      });
      const body = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = body; }
      results.push({
        variacao: `body_key_${key}`,
        numero_enviado: `{ "${key}": "${digits}" }`,
        method: 'POST',
        status: resp.status,
        response: typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 300) : String(parsed).substring(0, 300),
        tem_foto: !!(parsed?.profilePictureUrl || parsed?.url || parsed?.imgUrl)
      });
    } catch (e: any) {
      results.push({
        variacao: `body_key_${key}`,
        numero_enviado: `{ "${key}": "${digits}" }`,
        method: 'POST',
        status: 'EXCEPTION',
        response: e.message
      });
    }
  }

  const comFoto = results.filter(r => r.tem_foto).length;
  return res.json({
    telefone_original: inputPhone,
    digitos_limpos: digits,
    evolution_url: evoUrl,
    instance,
    total_testes: results.length,
    total_com_foto: comFoto,
    resultados: results
  });
}
