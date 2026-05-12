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
  is_group BOOLEAN DEFAULT false,
  is_typing BOOLEAN DEFAULT false,
  client_avatar TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_phone, tenant_id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT,
  is_internal BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  mime_type TEXT,
  file_name TEXT,
  external_message_id TEXT UNIQUE,
  status TEXT DEFAULT 'sent',
  tenant_id UUID,
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

-- TABELA DE DADOS FINANCEIROS
CREATE TABLE IF NOT EXISTS public.dados_financeiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    faturamento DECIMAL(15, 2) DEFAULT 0,
    compras DECIMAL(15, 2) DEFAULT 0,
    vendas DECIMAL(15, 2) DEFAULT 0,
    folha_pagamento DECIMAL(15, 2) DEFAULT 0,
    observacoes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(cliente_id, mes, ano)
);

-- Ativar RLS para dados financeiros
ALTER TABLE public.dados_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes do tenant vêem dados financeiros" ON public.dados_financeiros
    FOR ALL USING (tenant_id = auth.uid_tenant_id());

-- Gatilho para updated_at em dados financeiros
CREATE TRIGGER set_updated_at_dados_financeiros
    BEFORE UPDATE ON public.dados_financeiros
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. TABELA DE CONHECIMENTO DA IA
CREATE TABLE IF NOT EXISTS public.conhecimento_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    categoria TEXT NOT NULL, -- Trabalhista, Fiscal, etc
    subcategoria TEXT,
    conteudo TEXT NOT NULL,
    palavras_chave TEXT[],
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ativo', -- ativo, inativo, pendente
    origem TEXT NOT NULL DEFAULT 'manual', -- manual, conversa, importado
    nivel_confianca TEXT NOT NULL DEFAULT 'alta', -- alta, media, revisar
    data_validade TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    criado_por UUID REFERENCES public.usuarios(id),
    atualizado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- EXTENSÃO DA TABELA DE MENSAGENS PARA APRENDIZADO
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS feedback TEXT; -- positivo, negativo
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS intencao TEXT; -- intenção detectada
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS conhecimento_id UUID REFERENCES public.conhecimento_ia(id);

-- 7. TABELA DE HISTÓRICO DE VERSÕES (CONHECIMENTO)
CREATE TABLE IF NOT EXISTS public.conhecimento_ia_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conhecimento_id UUID NOT NULL REFERENCES public.conhecimento_ia(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    alterado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ativar RLS
ALTER TABLE public.conhecimento_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conhecimento_ia_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes do tenant vêem conhecimentos" ON public.conhecimento_ia
    FOR ALL USING (tenant_id = auth.uid_tenant_id());

CREATE POLICY "Participantes do tenant vêem histórico conhecimento" ON public.conhecimento_ia_historico
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.conhecimento_ia k 
        WHERE k.id = conhecimento_id AND k.tenant_id = auth.uid_tenant_id()
    ));

-- Gatilho para updated_at
CREATE TRIGGER set_updated_at_conhecimento_ia
    BEFORE UPDATE ON public.conhecimento_ia
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Desabilitar RLS para evitar bloqueios iniciais (Opcional se desejar segurança total imediata, remova estas linhas se preferir)
ALTER TABLE conhecimento_ia DISABLE ROW LEVEL SECURITY;
ALTER TABLE conhecimento_ia_historico DISABLE ROW LEVEL SECURITY;

-- 9. Desabilitar RLS para evitar bloqueios
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;

-- 10. TABELA DE CONFIGURAÇÕES DA EMPRESA
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
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

ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;

SELECT 'Setup concluído com segurança!' as status;