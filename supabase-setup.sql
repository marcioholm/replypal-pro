SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios';

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_salt TEXT;

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

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX idx_conversas_tenant ON conversas(tenant_id);
CREATE INDEX idx_conversas_status ON conversas(status);
CREATE INDEX idx_conversas_assigned ON conversas(assigned_to);
CREATE INDEX idx_mensagens_conversation ON mensagens(conversation_id);

INSERT INTO tenants (id, nome, subdomain) VALUES ('11111111-1111-1111-1111-111111111111', 'ReplyPal Pro', 'replypal') ON CONFLICT (id) DO NOTHING;

UPDATE usuarios SET senha_hash = 'Emeuc3DADa5TJ3Gr9aBDuVXgXK+Vk/CNwz5ZTSwmh5w=', senha_salt = 'replypal-pro-salt-v1' WHERE email = 'carlos@sasaki.com';
UPDATE usuarios SET senha_hash = 'X/g5Lu2iN+xFGW9AfqNOi+8F5+tYdYWw1L5dfIoiiw4=', senha_salt = 'replypal-pro-salt-v1' WHERE email = 'gabriel@sasaki.com';

INSERT INTO usuarios (id, email, nome, role, tenant_id, senha_hash, senha_salt) VALUES ('u1', 'carlos@sasaki.com', 'Carlos Silva', 'admin', '11111111-1111-1111-1111-111111111111', 'Emeuc3DADa5TJ3Gr9aBDuVXgXK+Vk/CNwz5ZTSwmh5w=', 'replypal-pro-salt-v1') ON CONFLICT (id) DO NOTHING;
INSERT INTO usuarios (id, email, nome, role, tenant_id, senha_hash, senha_salt) VALUES ('u2', 'gabriel@sasaki.com', 'Gabriel Souza', 'atendente', '11111111-1111-1111-1111-111111111111', 'X/g5Lu2iN+xFGW9AfqNOi+8F5+tYdYWw1L5dfIoiiw4=', 'replypal-pro-salt-v1') ON CONFLICT (id) DO NOTHING;

INSERT INTO clientes (id, razao_social, nome_fantasia, cnpj, responsavel, whatsapp, cidade, estado, status, tenant_id) VALUES ('c1', 'A A MAIA DA SILVA - CONSTRUTORA CIVIL', 'A A MAIA DA SILVA', '56.745.517/0001-64', 'Afonso Anhaia Maia da Silva', '42999896358', 'Santana do Itararé', 'PR', 'Ativo', '11111111-1111-1111-1111-111111111111') ON CONFLICT (id) DO NOTHING;

INSERT INTO conversas (id, client_name, client_phone, customer_id, status, tenant_id) VALUES ('conv1', 'Afonso Anhaia Maia da Silva', '42999896358', 'c1', 'novo', '11111111-1111-1111-1111-111111111111') ON CONFLICT (id) DO NOTHING;

INSERT INTO tags (id, nome, cor, tenant_id) VALUES ('t1', 'Urgente', '#ef4444', '11111111-1111-1111-1111-111111111111'), ('t2', 'Financeiro', '#22c55e', '11111111-1111-1111-1111-111111111111'), ('t3', 'Fiscal', '#3b82f6', '11111111-1111-1111-1111-111111111111'), ('t4', 'RH', '#a855f7', '11111111-1111-1111-1111-111111111111'), ('t5', 'Follow-up', '#f59e0b', '11111111-1111-1111-1111-111111111111') ON CONFLICT (id) DO NOTHING;

SELECT 'ReplyPal Pro atualizado!' as status;