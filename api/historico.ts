import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body;

  if (!body) return res.status(400).json({ error: 'body required' });

  const records = Array.isArray(body) ? body : [body];

  for (const record of records) {
    if (!record.conversation_id && !record.customer_id) {
      return res.status(400).json({ error: 'conversation_id or customer_id required' });
    }
  }

  try {
    const { data, error } = await supabase.from('historico').insert(records).select();

    if (error) {
      console.error('[HistoricoAPI] Erro ao inserir:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('[HistoricoAPI] Exception:', err);
    return res.status(500).json({ error: err.message });
  }
}
