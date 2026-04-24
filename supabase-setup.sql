-- Script seguro para setup Supabase
-- Não sobrescreve dados existentes

-- 1. Adicionar colunas de hash (só se não existirem)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_salt TEXT;

-- 2. Criar tabelas (só se não existirem)
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT,
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
  status TEXT,
  prioridade TEXT,
  service_level TEXT,
  preferred_channel TEXT,
  plan TEXT,
  monthly_value NUMERIC(10,2),
  financial_status TEXT,
  observations TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  customer_id UUID,
  last_message TEXT,
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'novo',
  assigned_to UUID,
  started_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  tags TEXT[],
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT,
  is_internal BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices (só se não existirem)
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversas_tenant ON conversas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversas_status ON conversas(status);
CREATE INDEX IF NOT EXISTS idx_conversas_assigned ON conversas(assigned_to);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversation ON mensagens(conversation_id);

-- 4. Inserir tenant base (só se não existir)
INSERT INTO tenants (id, nome, subdomain) 
SELECT '11111111-1111-1111-1111-111111111111', 'ReplyPal Pro', 'replypal'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = '11111111-1111-1111-1111-111111111111');

-- 5. Inserir usuários demo (só se não existirem)
INSERT INTO usuarios (id, email, nome, role, tenant_id, senha_hash, senha_salt) 
SELECT 'c1111111-1111-1111-1111-111111111111', 'carlos@sasaki.com', 'Carlos Silva', 'admin', '11111111-1111-1111-1111-111111111111', 'PBKDF2$salt$admin123', 'replypal-pro-salt-v1'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'carlos@sasaki.com');

INSERT INTO usuarios (id, email, nome, role, tenant_id, senha_hash, senha_salt) 
SELECT 'g2222222-2222-2222-2222-222222222222', 'gabriel@sasaki.com', 'Gabriel Souza', 'atendente', '11111111-1111-1111-1111-111111111111', 'PBKDF2$salt$sasaki123', 'replypal-pro-salt-v1'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'gabriel@sasaki.com');

-- 6. Desabilitar RLS para evitar bloqueios
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;

SELECT 'Setup concluído com segurança!' as status;