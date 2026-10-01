import type { VercelRequest, VercelResponse } from '@vercel/node';

// Só repassa para hosts do n8n conhecidos. Sem isso, qualquer pessoa podia usar
// este endpoint para fazer requisições a qualquer URL a partir da Vercel.
const DEFAULT_HOSTS = ['northway.vps8204.panel.icontainer.cloud'];

function allowedHosts(): Set<string> {
  const hosts = new Set(DEFAULT_HOSTS);
  (process.env.N8N_ALLOWED_HOSTS || '')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean)
    .forEach(h => hosts.add(h));
  for (const key of ['VITE_N8N_BASE_URL', 'VITE_N8N_IA_WEBHOOK', 'VITE_N8N_WEBHOOK_DOCUMENTOS']) {
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
  // 1. Permitir apenas métodos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { targetUrl, ...payload } = req.body;

  // 2. Validar se a URL de destino foi fornecida e é um n8n permitido
  if (!targetUrl) {
    return res.status(400).json({ error: 'Target URL is required' });
  }
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid target URL' });
  }
  if (target.protocol !== 'https:' || !allowedHosts().has(target.host)) {
    return res.status(403).json({ error: 'Target host not allowed' });
  }

  try {
    // 3. Fazer a requisição servidor-para-servidor (Bypass CORS)
    const response = await fetch(target.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.text();
    let jsonData;
    
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      jsonData = { message: data };
    }

    // 4. Retornar a resposta do n8n de volta para o frontend
    return res.status(response.status).json(jsonData);

  } catch (error) {
    console.error('Error in proxy webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
