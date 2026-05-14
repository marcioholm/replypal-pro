import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tenantId } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId' });
  }

  try {
    // 1. Buscar as credenciais da Evolution para este tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('evolution_instance, evolution_apikey, evolution_url')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ error: 'Tenant not found or missing Evolution config' });
    }

    const evolutionUrl = tenant.evolution_url || process.env.EVOLUTION_URL;
    const apiKey = tenant.evolution_apikey || process.env.EVOLUTION_API_KEY;
    const instance = tenant.evolution_instance;

    if (!evolutionUrl || !apiKey || !instance) {
      return res.status(400).json({ error: 'Incomplete Evolution configuration' });
    }

    // 2. Chamar a Evolution API para buscar contatos
    // Endpoint: GET /contact/fetchContacts/:instance
    const response = await fetch(`${evolutionUrl}/contact/fetchContacts/${instance}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to trigger Evolution sync');
    }

    // A Evolution API processa isso de forma assíncrona e enviará os contatos via Webhook
    // O Webhook que já configuramos (evolution-webhook.ts) receberá os eventos "CONTACTS_SET" e salvará na tabela 'contacts'

    return res.status(200).json({ 
      success: true, 
      message: 'Sincronização iniciada! Os contatos aparecerão em breve na Central Técnica.',
      evolutionResponse: result
    });

  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
