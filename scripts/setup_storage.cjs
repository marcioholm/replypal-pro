// Script para configurar o bucket de storage do Supabase
// Uso: node scripts/setup_storage.js <SUPABASE_URL> <SERVICE_ROLE_KEY>
//
// Onde encontrar:
// - SUPABASE_URL: Settings → API → Project URL
// - SERVICE_ROLE_KEY: Settings → API → service_role_key (NÃO é a anon key!)

const { createClient } = require("@supabase/supabase-js");

const [,, url, key] = process.argv;

if (!url || !key) {
  console.error("Uso: node scripts/setup_storage.js <SUPABASE_URL> <SERVICE_ROLE_KEY>");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function setup() {
  console.log("Configurando bucket chat-media...");

  // 1. Criar/atualizar bucket como público
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    // Se listar falhar, tenta criar direto
    console.log("Não foi possível listar buckets, tentando criar direto...");
  }

  const existing = buckets?.find(b => b.id === "chat-media");

  if (existing) {
    console.log("Bucket chat-media já existe, atualizando para público...");
    const { error } = await supabase.storage.updateBucket("chat-media", {
      public: true
    });
    if (error) {
      console.error("Erro ao atualizar bucket:", error.message);
      process.exit(1);
    }
    console.log("Bucket atualizado: public = true");
  } else {
    console.log("Criando bucket chat-media como público...");
    const { error } = await supabase.storage.createBucket("chat-media", {
      public: true
    });
    if (error) {
      console.error("Erro ao criar bucket:", error.message);
      process.exit(1);
    }
    console.log("Bucket criado com sucesso!");
  }

  // 2. Configurar políticas de acesso via SQL (executado como admin)
  console.log("\nConfigurando políticas de acesso...");
  const sql = `
    -- Garantir RLS ativo
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    -- Remover políticas existentes
    DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
    DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
    DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
    DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;

    -- Recriar políticas
    CREATE POLICY "Public Read Access" ON storage.objects
      FOR SELECT USING (bucket_id = 'chat-media');
    CREATE POLICY "Public Upload Access" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'chat-media');
    CREATE POLICY "Public Update Access" ON storage.objects
      FOR UPDATE USING (bucket_id = 'chat-media');
    CREATE POLICY "Public Delete Access" ON storage.objects
      FOR DELETE USING (bucket_id = 'chat-media');
  `;

  const { error: sqlError } = await supabase.rpc("exec_sql", { sql });
  if (sqlError) {
    // Pode não ter a função exec_sql, mas as policies já funcionam com o service role
    console.log("Nota:", sqlError.message);
    console.log("Mas com service_role_key, políticas não são necessárias para operações via backend.");
    console.log("Para o frontend carregar as mídias, o bucket público já deve bastar.");
  } else {
    console.log("Políticas configuradas com sucesso!");
  }

  // 3. Verificar resultado
  const { data: updated } = await supabase.storage.getBucket("chat-media");
  if (updated) {
    console.log("\n✅ Bucket chat-media:", JSON.stringify({
      id: updated.id,
      name: updated.name,
      public: updated.public
    }, null, 2));
  }

  console.log("\n✅ Configuração concluída!");
  console.log("\nAgora as mídias devem carregar normalmente no app.");
  console.log("Se ainda não funcionar, configure CORS no Supabase Dashboard:");
  console.log("Settings → API → CORS → Adicione * ou a URL do seu app");
}

setup().catch(err => {
  console.error("Erro:", err.message);
  process.exit(1);
});
