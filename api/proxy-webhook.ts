import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Permitir apenas métodos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { targetUrl, ...payload } = req.body;

  // 2. Validar se a URL de destino foi fornecida
  if (!targetUrl) {
    return res.status(400).json({ error: 'Target URL is required' });
  }

  try {
    // 3. Fazer a requisição servidor-para-servidor (Bypass CORS)
    const response = await fetch(targetUrl, {
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
