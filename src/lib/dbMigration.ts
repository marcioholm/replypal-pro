import { supabase } from "@/lib/supabase";

export async function createTables() {
  const sql = `
-- Tabelas ReplyPal ReplyPal

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role TEXT DEFAULT 'atendente',
  tenant_id UUID,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tenants (Empresas)
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
  type TEXT DEFAULT 'text',
  media_url TEXT,
  mime_type TEXT,
  file_name TEXT,
  external_message_id TEXT UNIQUE,
  status TEXT DEFAULT 'sent',
  tenant_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5.1 Mensagens Agendadas (Garantir que existe)
CREATE TABLE IF NOT EXISTS mensagens_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  conversa_id UUID REFERENCES conversas(id) ON DELETE SET NULL,
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
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  sender_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Histórico
CREATE TABLE IF NOT EXISTS historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  customer_id UUID,
  action TEXT NOT NULL,
  user_id UUID,
  user_name TEXT,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE,
  nome TEXT,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  logo_url TEXT,
  evolution_url TEXT,
  evolution_api_key TEXT,
  instance_name TEXT DEFAULT 'replypal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Automações de Relatórios
CREATE TABLE IF NOT EXISTS automacoes_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
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

-- Desabilitar RLS para evitar erros de permissão no frontend
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_agendadas DISABLE ROW LEVEL SECURITY;
ALTER TABLE automacoes_relatorios DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;

-- Garantir colunas em mensagens
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS external_message_id TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Garantir colunas em mensagens_agendadas
ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Garantir colunas em automacoes_relatorios
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_resumo_geral BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_por_usuario BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_pendentes BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_tempo_resposta BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_alertas BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS mensagem_intro TEXT;
`;

  try {
    const { data, error } = await supabase.rpc("exec_sql", { query: sql });
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("Error creating tables:", err);
    return { success: false, error: err };
  }
}