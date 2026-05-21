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
  start_date DATE,
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
  resolved_at TIMESTAMPTZ,
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

-- 11. Logs de Envios de Relatórios
CREATE TABLE IF NOT EXISTS relatorios_envios_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  configuracao_id UUID REFERENCES automacoes_relatorios(id) ON DELETE SET NULL,
  numero_destino TEXT NOT NULL,
  nome_destinatario TEXT,
  tipo TEXT DEFAULT 'resumo_diario_atendimento',
  status TEXT NOT NULL, -- 'enviado', 'erro', 'pendente'
  mensagem TEXT,
  response_json JSONB,
  erro TEXT,
  enviado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar RLS para evitar erros de permissão no frontend e webhooks
ALTER TABLE conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_agendadas DISABLE ROW LEVEL SECURITY;
ALTER TABLE automacoes_relatorios DISABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios_envios_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Garantir colunas em conversas
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS client_avatar TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT false;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS last_message_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS start_date DATE;


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
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT 'Relatório Diário';
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS numeros_destino JSONB DEFAULT '[]';
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_resumo_geral BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_por_usuario BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_pendentes BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_tempo_resposta BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS incluir_alertas BOOLEAN DEFAULT true;
ALTER TABLE automacoes_relatorios ADD COLUMN IF NOT EXISTS mensagem_intro TEXT;

-- Garantir UNIQUE constraint em automacoes_relatorios para permitir UPSERT
DO $$ 
BEGIN 
    -- Remover duplicatas antes de criar a constraint (manter apenas o mais recente)
    DELETE FROM automacoes_relatorios a
    WHERE a.id > (
        SELECT MIN(b.id) 
        FROM automacoes_relatorios b 
        WHERE a.tenant_id = b.tenant_id AND a.tipo = b.tipo
    );

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automacoes_relatorios_tenant_id_tipo_key') THEN 
        ALTER TABLE automacoes_relatorios ADD CONSTRAINT automacoes_relatorios_tenant_id_tipo_key UNIQUE (tenant_id, tipo); 
    END IF; 

    -- Garantir UNIQUE constraint em clientes para permitir UPSERT de contatos
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clientes_whatsapp_tenant_id_key') THEN 
        -- 1. Limpar caracteres não numéricos
        UPDATE clientes SET whatsapp = REGEXP_REPLACE(whatsapp, '\D', '', 'g') WHERE whatsapp IS NOT NULL;
        
        -- 2. Normalizar whatsapp existentes (adicionar 55 se tiver 10 ou 11 dígitos)
        UPDATE clientes 
        SET whatsapp = '55' || whatsapp 
        WHERE LENGTH(whatsapp) BETWEEN 10 AND 11 
        AND whatsapp NOT LIKE '55%';

        -- 3. Remover duplicatas antes de criar a constraint (manter apenas o mais recente)
        DELETE FROM clientes a
        WHERE a.id > (
            SELECT MIN(b.id) 
            FROM clientes b 
            WHERE (a.whatsapp = b.whatsapp OR (a.whatsapp IS NULL AND b.whatsapp IS NULL))
            AND a.tenant_id = b.tenant_id
        );
        
        ALTER TABLE clientes ADD CONSTRAINT clientes_whatsapp_tenant_id_key UNIQUE (whatsapp, tenant_id); 
    END IF; 

    -- Sincronizar conversas existentes com a tabela de clientes (vincular nomes e IDs)
    -- 1. Primeiro normalizamos os números nas conversas
    UPDATE conversas SET client_phone = REGEXP_REPLACE(client_phone, '\D', '', 'g') WHERE client_phone ~ '\D';
    
    -- 2. Atualizamos as conversas que ainda estão sem nome ou sem vínculo
    UPDATE conversas c
    SET 
        customer_id = cl.id,
        client_name = cl.nome_fantasia
    FROM clientes cl
    WHERE c.client_phone = cl.whatsapp
    AND c.tenant_id = cl.tenant_id
    AND (c.customer_id IS NULL OR c.client_name ~ '^[0-9]+$' OR c.client_name = c.client_phone);

    -- 3. Criar gatilhos para sincronização automática futura
    -- Sincronizar quando uma nova conversa entra
    CREATE OR REPLACE FUNCTION public.sync_conversa_with_cliente() RETURNS TRIGGER AS $$
    DECLARE
        target_id UUID;
        target_name TEXT;
    BEGIN
        SELECT id, nome_fantasia INTO target_id, target_name
        FROM public.clientes
        WHERE whatsapp = REGEXP_REPLACE(NEW.client_phone, '\D', '', 'g')
        AND tenant_id = NEW.tenant_id
        LIMIT 1;
        
        IF target_id IS NOT NULL THEN
            NEW.customer_id := target_id;
            NEW.client_name := target_name;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_conversa ON public.conversas;
    CREATE TRIGGER trg_sync_conversa
    BEFORE INSERT OR UPDATE OF client_phone ON public.conversas
    FOR EACH ROW EXECUTE FUNCTION public.sync_conversa_with_cliente();

    -- Sincronizar quando um novo cliente é cadastrado/importado
    CREATE OR REPLACE FUNCTION public.sync_cliente_with_conversas() RETURNS TRIGGER AS $$
    BEGIN
        UPDATE public.conversas
        SET 
            customer_id = NEW.id,
            client_name = NEW.nome_fantasia
        WHERE client_phone = NEW.whatsapp
        AND tenant_id = NEW.tenant_id
        AND (customer_id IS NULL OR client_name ~ '^[0-9]+$' OR client_name = client_phone);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_cliente ON public.clientes;
    CREATE TRIGGER trg_sync_cliente
    AFTER INSERT OR UPDATE OF whatsapp, nome_fantasia ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_with_conversas();
END $$;
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