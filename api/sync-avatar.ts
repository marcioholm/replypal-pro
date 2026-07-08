import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { conversationId } = req.body || {};
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

  try {
    const { data: conv } = await supabase
      .from('conversas')
      .select('id, client_phone, client_avatar, tenant_id')
      .eq('id', conversationId)
      .single();

    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
    if (conv.client_avatar) return res.json({ ok: true, message: 'Já tem avatar', url: conv.client_avatar });

    const phone = conv.client_phone;
    const tId = conv.tenant_id;
    const evoUrl = (process.env.EVOLUTION_URL || "").replace(/\/$/, "");
    const evoKey = process.env.EVOLUTION_API_KEY || "";
    const instanceName = process.env.INSTANCE_NAME || process.env.VITE_INSTANCE_NAME || "SASAKI";

    console.log(`[SyncAvatar] Buscando avatar para conversationId=${conversationId}, phone=${phone}, tenantId=${tId}`);

    // 1. Try contacts table (with real tenant_id)
    let avatarUrl: string | null = null;
    const searchPhones = [phone];
    if (phone.startsWith('55')) searchPhones.push(phone.substring(2));
    else searchPhones.push('55' + phone);

    for (const sp of searchPhones) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('foto_perfil')
        .or(`telefone_formatado.eq.${sp},jid.eq.${sp}@s.whatsapp.net,jid.eq.${sp}`)
        .not('foto_perfil', 'is', null)
        .eq('tenant_id', tId)
        .maybeSingle();
      if (contact?.foto_perfil && contact.foto_perfil !== 'null') {
        avatarUrl = contact.foto_perfil;
        console.log(`[SyncAvatar] Avatar encontrado em contacts: ${avatarUrl}`);
        break;
      }
    }

    // 2. Try Evolution API (with dynamic instance name)
    if (!avatarUrl && evoUrl && evoKey) {
      try {
        const rawPhone = phone.replace(/\D/g, '');
        console.log(`[SyncAvatar] Chamando Evolution API fetchProfilePictureUrl/${instanceName} para ${rawPhone}`);
        const resp = await fetch(`${evoUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
          body: JSON.stringify({ number: rawPhone })
        });
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data?.profilePictureUrl) {
            avatarUrl = data.profilePictureUrl;
            console.log(`[SyncAvatar] Avatar recebido da Evolution API: ${avatarUrl}`);
          } else {
            console.log(`[SyncAvatar] Evolution API respondeu sem profilePictureUrl:`, JSON.stringify(data).substring(0, 200));
          }
        } else {
          const errText = await resp.text();
          console.log(`[SyncAvatar] Evolution API erro ${resp.status}: ${errText.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.log(`[SyncAvatar] Evolution API exception: ${e.message}`);
      }
    }

    // 3. If found, store permanently
    if (avatarUrl) {
      if (!avatarUrl.includes('supabase.co')) {
        const stored = await storeProfilePic(avatarUrl, phone);
        if (stored) avatarUrl = stored;
      }
      await supabase.from('conversas').update({ client_avatar: avatarUrl }).eq('id', conv.id);
      console.log(`[SyncAvatar] Avatar salvo para conversationId=${conversationId}: ${avatarUrl}`);
      return res.json({ ok: true, message: 'Avatar salvo!', url: avatarUrl });
    }

    console.log(`[SyncAvatar] Nenhuma foto encontrada para ${phone}`);
    return res.json({ ok: false, message: 'Nenhuma foto encontrada para este contato' });
  } catch (err: any) {
    console.error(`[SyncAvatar] Erro:`, err);
    return res.status(500).json({ error: err.message });
  }
}

async function storeProfilePic(url: string, phone: string): Promise<string | null> {
  if (!url || url.includes('supabase.co')) return url || null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100) return null;
    const safePhone = phone.replace(/[^a-zA-Z0-9]/g, '_');
    const storagePath = `avatars/${safePhone}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("chat-media").upload(storagePath, buffer, {
      contentType: "image/jpeg", upsert: true
    });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(storagePath);
    return publicUrl;
  } catch {
    return null;
  }
}
