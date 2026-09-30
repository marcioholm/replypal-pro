const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findDuplicates() {
  console.log('--- Iniciando Detecção de Duplicados (Etapa 5) ---');
  
  // 1. Buscar todos os contatos
  const { data: contacts, error } = await supabase.from('contacts').select('*');
  if (error) {
    console.error('Erro ao buscar contatos:', error);
    return;
  }

  console.log(`Analisando ${contacts.length} contatos...`);

  // 2. Agrupar por telefone formatado (ou variações)
  const map = new Map();

  for (const c of contacts) {
    const key = c.telefone_formatado || c.telefone;
    if (!key) continue;

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }

  let duplicatedCount = 0;

  // 3. Marcar duplicados
  for (const [key, list] of map.entries()) {
    if (list.length > 1) {
      console.log(`Duplicidade encontrada para: ${key} (${list.length} registros)`);
      
      // Manter o mais recente como o "original"
      const sorted = list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const master = sorted[0];
      const duplicates = sorted.slice(1);

      for (const dup of duplicates) {
        await supabase.from('contacts').update({
          duplicado: true,
          duplicado_de: master.id,
          grupo_duplicidade: key
        }).eq('id', dup.id);
        duplicatedCount++;
      }
    } else {
      // Garantir que não está marcado como duplicado se estiver sozinho
      await supabase.from('contacts').update({
        duplicado: false,
        duplicado_de: null,
        grupo_duplicidade: null
      }).eq('id', list[0].id).eq('duplicado', true);
    }
  }

  console.log(`Detecção concluída. ${duplicatedCount} duplicados identificados.`);
}

findDuplicates();
