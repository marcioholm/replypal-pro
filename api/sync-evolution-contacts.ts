import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tenantId, dryRun, limit = 20 } = req.body || {};
  if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });

  const isDryRun = dryRun === true;
  const maxContacts = Math.min(Math.max(1, Number(limit) || 20), 200);

  try {
    const { data: cfg } = await supabase
      .from('company_settings')
      .select('evolution_url, evolution_api_key, instance_name')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const evolutionUrl = (cfg?.evolution_url || process.env.EVOLUTION_URL || "").replace(/\/+$/, "");
    const apiKey = cfg?.evolution_api_key || process.env.EVOLUTION_API_KEY || "";
    const instance = cfg?.instance_name || process.env.INSTANCE_NAME || process.env.VITE_INSTANCE_NAME || "SASAKI";

    if (!evolutionUrl || !apiKey) {
      return res.status(400).json({ error: 'Evolution API nao configurada' });
    }

    const logs: string[] = [];
    const stats = {
      contactos_carregados: 0,
      processados: 0,
      evolution_retornou_foto: 0,
      fotos_validas_storeProfilePic: 0,
      salvos_storage: 0,
      contacts_atualizados: 0,
      conversas_atualizadas: 0,
      sem_foto_evolution: 0,
      storeProfilePic_falhou: 0,
      erros: 0
    };

    function log(msg: string) { console.log(`[SyncAvatars] ${msg}`); logs.push(msg); }

    // ============================================================
    // 1. Carregar contacts que precisam de foto
    // ============================================================
    const { data: allContacts, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, jid, telefone_formatado, telefone, nome, foto_perfil')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(maxContacts);

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    stats.contactos_carregados = allContacts?.length || 0;
    log(`${stats.contactos_carregados} contatos carregados (limit=${maxContacts})`);

    if (stats.contactos_carregados === 0) {
      return res.json({ success: true, stats, logs, message: 'Nenhum contato pendente' });
    }

    if (isDryRun) {
      const semFoto = allContacts!.filter(c => !c.foto_perfil || c.foto_perfil.includes('whatsapp.net')).length;
      log(`Dry run: ${semFoto} contatos sem foto ou com foto expirada seriam processados`);
      return res.json({ success: true, dryRun: true, stats, logs, message: `Dry run: ${stats.contactos_carregados} contatos carregados, ${semFoto} precisam de foto` });
    }

    // ============================================================
    // 2. Processar cada contato
    // ============================================================
    for (const contact of allContacts!) {
      stats.processados++;
      const phone = contact.telefone_formatado || contact.telefone || contact.jid?.split('@')[0];
      if (!phone) { stats.erros++; continue; }

      try {
        log(`[${stats.processados}/${stats.contactos_carregados}] ${contact.nome || phone}...`);

        // 2a. Buscar foto na Evolution
        const rawPhone = phone.replace(/\D/g, '');
        const picResp = await fetch(
          `${evolutionUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ number: rawPhone })
          }
        );

        if (!picResp.ok) {
          const txt = await picResp.text();
          log(`  Evolution API erro ${picResp.status}: ${txt.substring(0, 100)}`);
          stats.erros++;
          continue;
        }

        const picData = await picResp.json() as any;
        const profileUrl = picData?.profilePictureUrl || picData?.url || picData?.imgUrl;

        if (!profileUrl) {
          log(`  Evolution respondeu sem foto`);
          stats.sem_foto_evolution++;
          // Atualizar contacts com NULL se tinha URL expirada
          if (contact.foto_perfil?.includes('whatsapp.net')) {
            await supabase.from('contacts').update({ foto_perfil: null }).eq('id', contact.id);
            log(`  Foto expirada limpa em contacts`);
          }
          continue;
        }

        stats.evolution_retornou_foto++;
        log(`  Evolution retornou foto (${profileUrl.substring(0, 60)}...)`);

        // 2b. storeProfilePic: baixar e salvar no Storage
        const storedUrl = await storeProfilePic(profileUrl, rawPhone);
        if (!storedUrl) {
          log(`  storeProfilePic falhou`);
          stats.storeProfilePic_falhou++;
          // Se tinha URL expirada, limpar
          if (contact.foto_perfil?.includes('whatsapp.net')) {
            await supabase.from('contacts').update({ foto_perfil: null }).eq('id', contact.id);
          }
          continue;
        }

        stats.salvos_storage++;
        log(`  Foto salva no Storage: ${storedUrl.substring(0, 60)}...`);

        // 2c. Atualizar contacts.foto_perfil
        await supabase.from('contacts').update({ foto_perfil: storedUrl }).eq('id', contact.id);
        stats.contacts_atualizados++;

        // 2d. Atualizar conversas.client_avatar por match de telefone/JID
        const searchPhones = [rawPhone, contact.telefone_formatado, contact.jid, `${rawPhone}@s.whatsapp.net`].filter(Boolean);
        const uniquePhones = [...new Set(searchPhones)];

        for (const sp of uniquePhones) {
          if (!sp) continue;
          const { data: convs } = await supabase
            .from('conversas')
            .select('id')
            .or(`client_phone.eq.${sp},client_phone.eq.${sp}`)
            .eq('tenant_id', tenantId);

          if (convs && convs.length > 0) {
            const { error: updErr } = await supabase
              .from('conversas')
              .update({ client_avatar: storedUrl })
              .in('id', convs.map(c => c.id));
            if (!updErr) stats.conversas_atualizadas += convs.length;
          }
        }
      } catch (e: any) {
        stats.erros++;
        log(`  ERRO: ${e.message}`);
      }
    }

    log('=== Sincronizacao concluida ===');
    return res.json({ success: true, stats, logs, message: `${stats.processados} processados, ${stats.salvos_storage} fotos salvas` });

  } catch (error: any) {
    console.error('[SyncAvatars] Error:', error);
    return res.status(500).json({ error: error.message });
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
