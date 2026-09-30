const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
  console.log('Criando tabelas contacts e contact_sync_logs...');
  
  // Como não podemos rodar SQL direto via JS sem RPC, vamos apenas simular ou usar o que temos.
  // No mundo real aqui usaríamos o Supabase CLI ou SQL Editor.
  // Vou tentar criar via RPC se existir, caso contrário, vou assumir que o usuário rodará no console.
  
  const sql = `
    -- Tabela de Contatos Técnicos
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      instance_name TEXT,
      jid TEXT,
      telefone TEXT,
      telefone_formatado TEXT,
      nome TEXT,
      nome_exibicao TEXT,
      foto_perfil TEXT,
      ddi TEXT,
      ddd TEXT,
      status_normalizacao TEXT DEFAULT 'NORMALIZADO',
      tipo_numero TEXT DEFAULT 'DESCONHECIDO',
      status_validacao TEXT DEFAULT 'PENDENTE_REVISAO',
      motivo_validacao TEXT,
      duplicado BOOLEAN DEFAULT false,
      duplicado_de UUID REFERENCES contacts(id),
      grupo_duplicidade TEXT,
      categoria_contato TEXT DEFAULT 'OUTRO',
      empresa_relacionada TEXT,
      possui_whatsapp BOOLEAN DEFAULT false,
      whatsapp_validado_em TIMESTAMPTZ,
      status_whatsapp TEXT DEFAULT 'PENDENTE',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(jid, tenant_id)
    );

    -- Tabela de Logs de Sincronização
    CREATE TABLE IF NOT EXISTS contact_sync_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      instance_name TEXT,
      evento_recebido TEXT,
      quantidade_contatos INTEGER DEFAULT 1,
      status TEXT,
      erro TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_contacts_phone_fmt ON contacts(telefone_formatado);
    CREATE INDEX IF NOT EXISTS idx_contacts_tenant_jid ON contacts(tenant_id, jid);
  `;

  console.log('Copie e cole este SQL no SQL Editor do Supabase:\n');
  console.log(sql);
}

setup();
