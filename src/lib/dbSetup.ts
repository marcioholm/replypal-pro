import { supabase } from "./supabase";
import { createTables } from "./dbMigration";

const CREATE_TABLES_SQL = `
-- 1. Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role TEXT DEFAULT 'atendente',
  tenant_id UUID,
  avatar TEXT,
  senha TEXT, 
  senha_hash TEXT, 
  senha_salt TEXT, 
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  responsavel TEXT,
  whatsapp TEXT,
  telefone TEXT,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  regime_tributario TEXT,
  natureza_juridica TEXT,
  cnae TEXT,
  opening_date DATE,
  has_employees BOOLEAN DEFAULT false,
  employee_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Onboarding',
  prioridade TEXT DEFAULT 'Média',
  service_level TEXT DEFAULT 'Padrão',
  preferred_channel TEXT DEFAULT 'WhatsApp',
  plan TEXT,
  monthly_value NUMERIC(10,2) DEFAULT 0,
  financial_status TEXT DEFAULT 'Atenção',
  observations TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Conversas
CREATE TABLE IF NOT EXISTS conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  customer_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'novo',
  assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mensagens
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversas(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID
);

-- 6. Mensagens Agendadas
CREATE TABLE IF NOT EXISTS mensagens_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  cliente_id UUID,
  conversa_id UUID,
  receiver_number TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  text_content TEXT,
  media_url TEXT,
  mime_type TEXT,
  file_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'agendada',
  error_message TEXT,
  created_by UUID,
  sender_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Automações de Relatórios
CREATE TABLE IF NOT EXISTS automacoes_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  horario TIME NOT NULL,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  numeros_destino JSONB DEFAULT '[]',
  incluir_resumo_geral BOOLEAN DEFAULT true,
  incluir_por_usuario BOOLEAN DEFAULT true,
  incluir_pendentes BOOLEAN DEFAULT true,
  incluir_tempo_resposta BOOLEAN DEFAULT true,
  incluir_alertas BOOLEAN DEFAULT true,
  mensagem_intro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, tipo)
);

-- Desabilitar RLS
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_agendadas DISABLE ROW LEVEL SECURITY;
ALTER TABLE automacoes_relatorios DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;
`;

export async function initializeDatabase() {
  try {
    // Garantir que as tabelas existem
    await createTables();

    const tenantId = '11111111-1111-1111-1111-111111111111';

    // 1. Tenants
    const { error: tError } = await supabase.from("tenants").upsert({
      id: tenantId,
      nome: 'ReplyPal Pro',
      subdomain: 'replypal'
    });
    if (tError) console.error("Erro no upsert tenants:", tError.message);

    // 2. Usuarios
    const { error: uError } = await supabase.from("usuarios").upsert([
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'carlos@sasaki.com',
        nome: 'Carlos Silva',
        role: 'admin',
        tenant_id: tenantId,
        senha: 'admin123',
        senha_hash: 'Emeuc3DADa5TJ3Gr9aBDuVXgXK+Vk/CNwz5ZTSwmh5w=',
        senha_salt: 'replypal-pro-salt-v1'
      }
    ]);
    if (uError) console.error("Erro no upsert usuarios:", uError.message);

    // 3. Clientes (Removido para produção)
    /*
    const { error: cError } = await supabase.from("clientes").upsert({
      id: '33333333-3333-3333-3333-333333333333',
      nome_fantasia: 'A A MAIA DA SILVA',
      cnpj: '56.745.517/0001-64',
      tenant_id: tenantId
    });
    if (cError) console.error("Erro no upsert clientes:", cError.message);
    */

    return { success: true };
  } catch (err) {
    console.error("Erro crítico na inicialização do banco:", err);
    return { success: false, error: err };
  }
}

export { CREATE_TABLES_SQL };