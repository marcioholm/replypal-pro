-- Tabelas ReplyPal Sasaki

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'supervisor', 'atendente')) DEFAULT 'atendente',
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
  consultant_id UUID REFERENCES usuarios(id),
  attendant_id UUID REFERENCES usuarios(id),
  supervisor_id UUID REFERENCES usuarios(id),
  status TEXT CHECK (status IN ('Ativo', 'Onboarding', 'Inativo', 'Encerrado')) DEFAULT 'Onboarding',
  prioridade TEXT CHECK (prioridade IN ('Baixa', 'Média', 'Alta')) DEFAULT 'Média',
  service_level TEXT CHECK (service_level IN ('Padrão', 'Premium', 'Estratégico')) DEFAULT 'Padrão',
  preferred_channel TEXT CHECK (preferred_channel IN ('WhatsApp', 'Email', 'Telefone')) DEFAULT 'WhatsApp',
  plan TEXT,
  monthly_value NUMERIC(10,2) DEFAULT 0,
  financial_status TEXT CHECK (financial_status IN ('Adimplente', 'Inadimplente', 'Atenção')) DEFAULT 'Atenção',
  observations TEXT,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Conversas
CREATE TABLE IF NOT EXISTS conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  customer_id UUID REFERENCES clientes(id),
  last_message TEXT,
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('novo', 'aguardando_aceite', 'em_atendimento', 'aguardando_cliente', 'resolvido')) DEFAULT 'novo',
  assigned_to UUID REFERENCES usuarios(id),
  started_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mensagens
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversas(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT CHECK (sender IN ('client', 'agent')) NOT NULL,
  sender_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Contatos (pessoas de contato dos clientes)
CREATE TABLE IF NOT EXISTS contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  role TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  tipo TEXT CHECK (tipo IN ('Financeiro', 'RH', 'Fiscal', 'Societário', 'Outro')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Histórico de ações
CREATE TABLE IF NOT EXISTS historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversas(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES usuarios(id),
  user_name TEXT,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Configurações da Empresa
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) UNIQUE,
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

-- 10. Contador de Recibos
CREATE TABLE IF NOT EXISTS recibo_contador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) UNIQUE,
  contador INTEGER DEFAULT 0,
  ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibo_contador ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (exemplo básico - ajustar conforme necessidade)
CREATE POLICY "Allow all for authenticated users" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON conversas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON mensagens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON contatos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON historico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON company_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON recibo_contador FOR ALL USING (true) WITH CHECK (true);

-- Inserir dados iniciais
INSERT INTO tenants (id, nome, subdomain) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Sasaki Contabilidade', 'sasaki')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, email, nome, role, tenant_id) VALUES 
  ('u1', 'carlos@sasaki.com', 'Carlos Silva', 'admin', '11111111-1111-1111-1111-111111111111'),
  ('u2', 'ana@sasaki.com', 'Ana Souza', 'supervisor', '11111111-1111-1111-1111-111111111111'),
  ('u3', 'joao@sasaki.com', 'João Santos', 'atendente', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;