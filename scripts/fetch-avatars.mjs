import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import { createWriteStream, readFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import P from 'pino';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== CONFIG =====
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TENANT_ID = process.env.TENANT_ID || process.env.VITE_TENANT_ID;
const SESSION_DIR = path.join(__dirname, 'baileys_session');
// ==================

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!TENANT_ID) {
  console.error('Defina TENANT_ID (ou VITE_TENANT_ID) no ambiente');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function storeProfilePic(url, phone) {
  if (!url || url.includes('supabase.co')) return url;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 100) return null;
    const safePhone = phone.replace(/[^a-zA-Z0-9]/g, '_');
    const storagePath = `avatars/${safePhone}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('chat-media').upload(storagePath, buffer, {
      contentType: 'image/jpeg', upsert: true,
    });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(storagePath);
    return publicUrl;
  } catch { return null; }
}

async function main() {
  console.log('Buscando conversas sem avatar...');
  const { data: conversas, error } = await supabase
    .from('conversas')
    .select('id, client_phone, client_name')
    .is('client_avatar', null)
    .eq('tenant_id', TENANT_ID);

  if (error || !conversas?.length) {
    console.log(error?.message || 'Nenhuma conversa sem avatar.');
    return;
  }

  console.log(`${conversas.length} conversas sem avatar. Conectando ao WhatsApp...`);

  await mkdir(SESSION_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  // Aguardar conexão
  await new Promise((resolve) => {
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) console.log('\n⚠️  Escaneie o QR code acima com seu WhatsApp\n');
      if (connection === 'open') {
        console.log('✅ Conectado ao WhatsApp!');
        resolve(true);
      }
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        if (shouldReconnect) {
          console.log('Reconectando...');
          main();
        } else {
          console.error('❌ Sessão expirou. Delete a pasta baileys_session e tente de novo.');
          process.exit(1);
        }
      }
    });
  });

  let ok = 0, fail = 0, noPhoto = 0;
  console.log(`\nBuscando fotos para ${conversas.length} contatos...`);

  for (const conv of conversas) {
    const phone = conv.client_phone;
    const rawPhone = phone.replace(/\D/g, '');
    const jid = rawPhone.includes('@') ? rawPhone : `${rawPhone}@s.whatsapp.net`;

    try {
      const picUrl = await sock.profilePictureUrl(jid, 'image');
      if (picUrl) {
        const stored = await storeProfilePic(picUrl, phone);
        if (stored) {
          await supabase.from('conversas').update({ client_avatar: stored }).eq('id', conv.id);
          console.log(`✅ ${conv.client_name || phone} — foto salva`);
          ok++;
        } else {
          console.log(`⚠️  ${conv.client_name || phone} — download falhou`);
          fail++;
        }
      } else {
        console.log(`⛔ ${conv.client_name || phone} — sem foto`);
        noPhoto++;
      }
    } catch (err) {
      if (err.message?.includes('404')) {
        console.log(`⛔ ${conv.client_name || phone} — sem foto (404)`);
        noPhoto++;
      } else {
        console.log(`❌ ${conv.client_name || phone} — erro: ${err.message}`);
        fail++;
      }
    }

    // Delay entre requisições para evitar rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Resumo ===`);
  console.log(`✅ Fotos salvas: ${ok}`);
  console.log(`⛔ Sem foto: ${noPhoto}`);
  console.log(`❌ Erros: ${fail}`);

  sock.ws.close();
  process.exit(0);
}

main().catch(console.error);
