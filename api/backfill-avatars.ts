import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const evoUrl = (process.env.EVOLUTION_URL || "").replace(/\/$/, "");
const evoKey = process.env.EVOLUTION_API_KEY || "";
const instanceName = process.env.INSTANCE_NAME || process.env.VITE_INSTANCE_NAME || "SASAKI";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const tenantId = req.body?.tenantId || req.query?.tenantId as string;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

  const dryRun = req.body?.dryRun === true;

  try {
    // 1. Buscar todos os contacts com foto_perfil contendo whatsapp.net (URLs temporárias)
    const { data: dirtyContacts, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, jid, telefone_formatado, telefone, nome, foto_perfil')
      .eq('tenant_id', tenantId)
      .or('foto_perfil.like.%whatsapp.net%,foto_perfil.like.%pps.whatsapp%')
      .limit(2000);

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });

    const totalDirty = dirtyContacts?.length || 0;
    console.log(`[BackfillAvatars] Total contacts com foto temporária: ${totalDirty}`);

    if (totalDirty === 0) {
      return res.json({
        ok: true,
        message: 'Nenhum contact com foto temporária encontrado',
        total_dirty: 0
      });
    }

    if (dryRun) {
      return res.json({
        ok: true,
        dry_run: true,
        total_dirty: totalDirty,
        message: `${totalDirty} contacts precisam de atualização. Execute sem dryRun para processar.`,
        sample: dirtyContacts?.slice(0, 3)
      });
    }

    let processed = 0;
    let stored = 0;
    let noPhoto = 0;
    let errors = 0;
    let convosUpdated = 0;
    let convosStillEmpty = 0;

    for (const contact of dirtyContacts) {
      processed++;
      const phone = contact.telefone_formatado || contact.telefone || contact.jid?.split('@')[0];
      if (!phone) { errors++; continue; }

      try {
        // 2. Buscar foto atual na Evolution API
        let avatarUrl: string | null = null;

        if (evoUrl && evoKey) {
          const rawPhone = phone.replace(/\D/g, '');
          const resp = await fetch(
            `${evoUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
              body: JSON.stringify({ number: rawPhone })
            }
          );

          if (resp.ok) {
            const data = await resp.json() as any;
            if (data?.profilePictureUrl) {
              avatarUrl = data.profilePictureUrl;
            }
          } else {
            const errText = await resp.text();
            console.log(`[BackfillAvatars] Evolution API erro ${resp.status} para ${phone}: ${errText.substring(0, 100)}`);
          }
        }

        // 3. Se achou, armazenar permanentemente
        if (avatarUrl) {
          const permanent = await storeProfilePic(avatarUrl, phone);
          if (permanent) {
            avatarUrl = permanent;
            stored++;

            // 4. Atualizar contacts.foto_perfil
            await supabase.from('contacts').update({ foto_perfil: avatarUrl }).eq('id', contact.id);

            // 5. Atualizar conversas.client_avatar por match de telefone/JID
            const searchPhones = [phone];
            if (phone.startsWith('55')) searchPhones.push(phone.substring(2));
            else searchPhones.push('55' + phone);

            for (const sp of searchPhones) {
              const { data: convs } = await supabase
                .from('conversas')
                .select('id')
                .or(`client_phone.eq.${sp},client_phone.eq.${sp}@s.whatsapp.net`)
                .eq('tenant_id', tenantId);

              if (convs && convs.length > 0) {
                const { error: updErr } = await supabase
                  .from('conversas')
                  .update({ client_avatar: avatarUrl })
                  .in('id', convs.map(c => c.id));

                if (!updErr) convosUpdated += convs.length;
              }
            }

            console.log(`[BackfillAvatars] OK: ${phone} -> avatar salvo`);
          } else {
            // storeProfilePic falhou
            await supabase.from('contacts').update({ foto_perfil: null }).eq('id', contact.id);
            noPhoto++;
            console.log(`[BackfillAvatars] storeProfilePic falhou para ${phone}, setado NULL`);
          }
        } else {
          // Evolution não retornou foto
          await supabase.from('contacts').update({ foto_perfil: null }).eq('id', contact.id);
          noPhoto++;
          console.log(`[BackfillAvatars] Sem foto na Evolution para ${phone}, setado NULL`);
        }
      } catch (e: any) {
        errors++;
        console.error(`[BackfillAvatars] Erro ao processar ${phone}: ${e.message}`);
      }

      // Pequena pausa a cada 50 para não rate-limit a Evolution API
      if (processed % 50 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Contar conversas que AINDA estão sem avatar (para o relatório)
    const { count: stillEmpty } = await supabase
      .from('conversas')
      .select('*', { count: 'exact', head: true })
      .is('client_avatar', null)
      .eq('tenant_id', tenantId);

    convosStillEmpty = stillEmpty || 0;

    console.log(`[BackfillAvatars] FINAL: total_dirty=${totalDirty} processados=${processed} salvos_storage=${stored} sem_foto=${noPhoto} erros=${errors} conversas_atualizadas=${convosUpdated} conversas_sem_avatar=${convosStillEmpty}`);

    return res.json({
      ok: true,
      total_dirty: totalDirty,
      processados: processed,
      salvos_storage: stored,
      sem_foto_evolution: noPhoto,
      erros: errors,
      conversas_atualizadas: convosUpdated,
      conversas_sem_avatar: convosStillEmpty
    });
  } catch (err: any) {
    console.error('[BackfillAvatars] Erro geral:', err);
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
