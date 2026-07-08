import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tenantId, dryRun } = req.body || {};

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId' });
  }

  const isDryRun = dryRun === true;

  try {
    // Buscar config da Evolution em company_settings
    let evolutionUrl = process.env.EVOLUTION_URL || "";
    let apiKey = process.env.EVOLUTION_API_KEY || "";
    let instance = process.env.INSTANCE_NAME || process.env.VITE_INSTANCE_NAME || "SASAKI";

    const { data: companyCfg } = await supabase
      .from('company_settings')
      .select('evolution_url, evolution_api_key, instance_name')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (companyCfg) {
      if (companyCfg.evolution_url) evolutionUrl = companyCfg.evolution_url;
      if (companyCfg.evolution_api_key) apiKey = companyCfg.evolution_api_key;
      if (companyCfg.instance_name) instance = companyCfg.instance_name;
    }

    if (!evolutionUrl || !apiKey) {
      return res.status(404).json({ error: 'Evolution API não configurada. Configure em Configurações > WhatsApp.' });
    }

    evolutionUrl = evolutionUrl.replace(/\/+$/, "");

    if (!evolutionUrl || !apiKey || !instance) {
      return res.status(400).json({ error: 'Incomplete Evolution configuration' });
    }

    const logs: string[] = [];
    const stats = {
      contacts_encontrados: 0,
      individuais: 0,
      grupos: 0,
      com_foto_evolution: 0,
      salvos_storage: 0,
      atualizados_contacts: 0,
      atualizados_conversas: 0,
      sem_foto: 0,
      erros: 0
    };

    function log(msg: string) {
      console.log(`[SyncContacts] ${msg}`);
      logs.push(msg);
    }

    // ============================================================
    // 1. Buscar contatos da Evolution API
    // ============================================================
    log(`Buscando contatos de ${evolutionUrl}/contact/fetchContacts/${instance}...`);

    const contactsResp = await fetch(`${evolutionUrl}/contact/fetchContacts/${encodeURIComponent(instance)}`, {
      method: 'GET',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' }
    });

    if (!contactsResp.ok) {
      const errText = await contactsResp.text();
      log(`Erro Evolution API: ${contactsResp.status} ${errText.substring(0, 200)}`);
      return res.status(502).json({ error: `Evolution API error: ${contactsResp.status}`, detail: errText.substring(0, 300) });
    }

    const contactsData = await contactsResp.json();
    const allContacts = Array.isArray(contactsData) ? contactsData : (contactsData.contacts || contactsData.data || []);

    if (!Array.isArray(allContacts) || allContacts.length === 0) {
      log('Nenhum contato retornado pela Evolution API');
      return res.json({ success: true, stats, logs, message: 'Nenhum contato encontrado na Evolution' });
    }

    stats.contacts_encontrados = allContacts.length;
    log(`${allContacts.length} contatos recebidos da Evolution API`);

    // Separar individuais e grupos
    const individuals = allContacts.filter((c: any) => {
      const jid = c.id || c.remoteJid || c.jid || '';
      return !jid.endsWith('@g.us');
    });
    const groupEntries = allContacts.filter((c: any) => {
      const jid = c.id || c.remoteJid || c.jid || '';
      return jid.endsWith('@g.us');
    });

    stats.individuais = individuals.length;
    stats.grupos = groupEntries.length;
    log(`${individuals.length} individuais, ${groupEntries.length} grupos`);

    if (isDryRun) {
      log('=== DRY RUN - Nenhum dado foi alterado ===');
      return res.json({
        success: true,
        dryRun: true,
        stats,
        logs,
        message: `Dry run: ${stats.contacts_encontrados} contatos (${stats.individuais} individuais, ${stats.grupos} grupos) seriam processados`,
        sample_individual: individuals.slice(0, 3),
        sample_group: groupEntries.slice(0, 2)
      });
    }

    // ============================================================
    // 2. Processar individuais: buscar foto, salvar, atualizar
    // ============================================================
    for (const contact of individuals) {
      try {
        const remoteJid = contact.id || contact.remoteJid || contact.jid;
        if (!remoteJid) { stats.erros++; continue; }

        const rawPhone = remoteJid.split('@')[0];
        const pushName = contact.name || contact.pushName || contact.subject || remoteJid;
        const rawPic = contact.profilePicUrl || contact.imgUrl || contact.picture;

        // 2a. Buscar foto de perfil na Evolution API (sempre, pra garantir URL fresca)
        let avatarUrl: string | null = null;

        try {
          const picResp = await fetch(`${evolutionUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ number: rawPhone })
          });
          if (picResp.ok) {
            const picData = await picResp.json() as any;
            if (picData?.profilePictureUrl) {
              avatarUrl = picData.profilePictureUrl;
              stats.com_foto_evolution++;
            }
          }
        } catch (e: any) {
          log(`Erro fetchProfilePictureUrl para ${rawPhone}: ${e.message}`);
        }

        // 2b. Fallback: usar a URL que veio junto com o contato (se houver)
        if (!avatarUrl && rawPic && !rawPic.includes('whatsapp.net') && !rawPic.includes('pps.whatsapp')) {
          avatarUrl = rawPic;
        }

        // 2c. Passar por storeProfilePic
        let storedUrl: string | null = null;
        if (avatarUrl) {
          storedUrl = await storeProfilePic(avatarUrl, rawPhone);
          if (storedUrl) {
            stats.salvos_storage++;
          } else {
            log(`storeProfilePic falhou para ${rawPhone}`);
          }
        } else {
          stats.sem_foto++;
        }

        // 2d. Upsert em contacts
        const { error: hygieneErr, data: hygiene } = analyzeAndHygienize(rawPhone);

        const contactPayload: any = {
          tenant_id: tenantId,
          instance_name: instance,
          jid: remoteJid,
          telefone: rawPhone,
          telefone_formatado: hygiene?.telefone_formatado || rawPhone,
          nome: pushName,
          nome_exibicao: pushName,
          foto_perfil: storedUrl || null,
          ddi: hygiene?.ddi || '55',
          ddd: hygiene?.ddd || '',
          status_normalizacao: hygiene?.status_normalizacao || 'NORMALIZADO',
          tipo_numero: hygiene?.tipo_numero || 'DESCONHECIDO',
          status_validacao: hygiene?.status_validacao || 'VALIDO',
          motivo_validacao: hygiene?.motivo_validacao || '',
          updated_at: new Date().toISOString()
        };

        const { error: upsertErr } = await supabase
          .from('contacts')
          .upsert(contactPayload, { onConflict: 'jid,tenant_id' });

        if (upsertErr) {
          log(`Erro upsert contacts ${rawPhone}: ${upsertErr.message}`);
          stats.erros++;
        } else {
          stats.atualizados_contacts++;
        }

        // 2e. Atualizar conversas.client_avatar por match de telefone/JID
        if (storedUrl) {
          const searchPhones = [rawPhone, `55${rawPhone}`, hygiene?.telefone_formatado || rawPhone].filter(Boolean);
          const uniquePhones = [...new Set(searchPhones)];

          for (const sp of uniquePhones) {
            if (!sp) continue;
            const { data: convs } = await supabase
              .from('conversas')
              .select('id')
              .or(`client_phone.eq.${sp},client_phone.eq.${sp}@s.whatsapp.net`)
              .eq('tenant_id', tenantId);

            if (convs && convs.length > 0) {
              const { error: updErr } = await supabase
                .from('conversas')
                .update({ client_avatar: storedUrl })
                .in('id', convs.map(c => c.id));

              if (!updErr) stats.atualizados_conversas += convs.length;
            }
          }
        }
      } catch (e: any) {
        stats.erros++;
        log(`Erro processando contato: ${e.message}`);
      }
    }

    // ============================================================
    // 3. Processar grupos
    // ============================================================
    for (const group of groupEntries) {
      try {
        const remoteJid = group.id || group.remoteJid || group.jid;
        if (!remoteJid) { stats.erros++; continue; }

        const subject = group.name || group.subject || remoteJid;
        const rawPic = group.profilePicUrl || group.imgUrl || group.picture;

        // Buscar foto do grupo
        let groupPic: string | null = null;
        if (rawPic && !rawPic.includes('whatsapp.net') && !rawPic.includes('pps.whatsapp')) {
          groupPic = rawPic;
        }

        let storedGroupPic: string | null = null;
        if (groupPic) {
          storedGroupPic = await storeProfilePic(groupPic, remoteJid.replace(/\D/g, '_'));
          if (storedGroupPic) stats.salvos_storage++;
        }

        const now = new Date();
        const slaDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const { error: upsertErr } = await supabase
          .from('conversas')
          .upsert({
            client_name: subject,
            client_phone: remoteJid,
            status: 'novo',
            tenant_id: tenantId,
            client_avatar: storedGroupPic || null,
            is_group: true,
            sla_deadline: slaDeadline.toISOString(),
            last_message_time: now.toISOString()
          }, { onConflict: 'client_phone,tenant_id' });

        if (upsertErr) {
          log(`Erro upsert grupo ${remoteJid}: ${upsertErr.message}`);
          stats.erros++;
        }
      } catch (e: any) {
        stats.erros++;
        log(`Erro processando grupo: ${e.message}`);
      }
    }

    log('=== Sincronização concluída ===');
    log(`Contacts: ${stats.atualizados_contacts} atualizados | Conversas: ${stats.atualizados_conversas} atualizadas`);
    log(`Fotos: ${stats.com_foto_evolution} retornadas, ${stats.salvos_storage} salvas no Storage, ${stats.sem_foto} sem foto`);

    return res.status(200).json({
      success: true,
      stats,
      logs,
      message: `Sincronização concluída! ${stats.atualizados_contacts} contatos, ${stats.atualizados_conversas} conversas atualizadas`
    });

  } catch (error: any) {
    console.error('[SyncContacts] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// Helpers
// ============================================================

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

async function analyzeAndHygienize(phone: string): Promise<{ error?: any; data?: any }> {
  try {
    const original = phone;
    let cleaned = phone.replace(/\D/g, "");
    let ddi = "55";
    let ddd = "";
    let status_normalizacao = "NORMALIZADO";
    let tipo_numero = "DESCONHECIDO";
    let status_validacao = "VALIDO";
    let motivo_validacao = "";

    if (!cleaned) {
      return { data: { status_normalizacao: "FORMATO_INVALIDO", status_validacao: "INVALIDO", motivo_validacao: "Vazio" } };
    }

    if (cleaned.startsWith("55")) {
      ddi = "55";
      if (cleaned.length >= 4) ddd = cleaned.substring(2, 4);
    } else {
      ddi = "55";
      if (cleaned.length >= 2) ddd = cleaned.substring(0, 2);
      cleaned = "55" + cleaned;
    }

    if (!ddd || ddd.length < 2) {
      status_normalizacao = "PENDENTE_DDD";
      status_validacao = "PENDENTE_REVISAO";
      motivo_validacao = "DDD não identificado";
    }

    const numberPart = cleaned.startsWith("55") ? cleaned.substring(4) : cleaned.substring(2);
    const firstDigit = numberPart[0];

    if (["2", "3", "4", "5"].includes(firstDigit)) {
      tipo_numero = "FIXO";
    } else if (["6", "7", "8", "9"].includes(firstDigit)) {
      tipo_numero = "MOVEL";
    } else {
      tipo_numero = "INVALIDO";
      status_validacao = "INVALIDO";
      motivo_validacao = "Início de número inválido";
    }

    if (tipo_numero === "MOVEL") {
      if (numberPart.length === 8) {
        status_validacao = "SEM_NONO_DIGITO";
        motivo_validacao = "Celular sem o dígito 9";
      } else if (numberPart.length === 9) {
        if (firstDigit !== "9") {
          status_validacao = "INVALIDO";
          motivo_validacao = "Celular com 9 dígitos não inicia com 9";
        }
      } else if (numberPart.length > 9) {
        status_validacao = "DIGITOS_EXCEDENTES";
        motivo_validacao = "Número muito longo";
      } else {
        status_validacao = "INCOMPLETO";
        motivo_validacao = "Número muito curto";
      }
    } else if (tipo_numero === "FIXO") {
      if (numberPart.length !== 8) {
        status_validacao = "INCOMPLETO";
        motivo_validacao = "Fixo deve ter 8 dígitos";
      }
    }

    return {
      data: {
        ddi, ddd, telefone: original, telefone_formatado: cleaned,
        status_normalizacao, tipo_numero, status_validacao, motivo_validacao
      }
    };
  } catch (e) {
    return { error: e, data: { telefone_formatado: phone } };
  }
}
