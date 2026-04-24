import { supabase } from "./supabase";

const CREATE_TABLES_SQL = `
-- Execute este SQL no Supabase SQL Editor
-- https://supabase.com/dashboard/project/xvvgjeccncfylvvbjgwj/sql

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
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- 6. Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Historico
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

-- 9. Contador de Recibos
CREATE TABLE IF NOT EXISTS recibo_contador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE,
  contador INTEGER DEFAULT 0,
  ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Documentos
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mes INTEGER,
  ano INTEGER,
  url TEXT,
  nome_arquivo TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  uploaded_by TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE
);


-- 11. Dados Financeiros (Lançamento Manual)
CREATE TABLE IF NOT EXISTS dados_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  faturamento NUMERIC(15,2) DEFAULT 0,
  compras NUMERIC(15,2) DEFAULT 0,
  vendas NUMERIC(15,2) DEFAULT 0,
  folha_pagamento NUMERIC(15,2) DEFAULT 0,
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, mes, ano)
);


-- Inserir dados iniciais
INSERT INTO tenants (id, nome, subdomain) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'ReplyPal Pro', 'replypal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, email, nome, role, tenant_id) VALUES 
  ('u1', 'carlos@replypal.com', 'Carlos Silva', 'admin', '11111111-1111-1111-1111-111111111111'),
  ('u2', 'ana@replypal.com', 'Ana Souza', 'supervisor', '11111111-1111-1111-1111-111111111111'),
  ('u3', 'joao@replypal.com', 'João Santos', 'atendente', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;
`;

export async function initializeDatabase() {
  try {
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id")
      .limit(1);
    
    if (tenantsError && tenantsError.message.includes("does not exist")) {
      console.log("Tables do not exist. Please run the SQL below in Supabase SQL Editor:");
      console.log(CREATE_TABLES_SQL);
      return { success: false, needsSetup: true, sql: CREATE_TABLES_SQL };
    }
    
    return { success: true, needsSetup: false };
  } catch (err) {
    console.log("Database not initialized. Please run SQL in Supabase:");
    console.log(CREATE_TABLES_SQL);
    return { success: false, needsSetup: true, sql: CREATE_TABLES_SQL };
  }
}

export { CREATE_TABLES_SQL };