-- 002_rich_media_and_scheduling.sql
-- Adicionar suporte a mídia rica e agendamento

-- 1. Atualizar tabela mensagens
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('text', 'audio', 'image', 'video', 'document', 'sticker')) DEFAULT 'text';
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS media_storage_path TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS waveform_data JSONB;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS external_message_id TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'error')) DEFAULT 'sent';
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Criar índice para performance de busca por external_message_id (webhooks)
CREATE INDEX IF NOT EXISTS idx_mensagens_external_id ON mensagens(external_message_id);

-- 2. Criar tabela mensagens_agendadas
CREATE TABLE IF NOT EXISTS mensagens_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  cliente_id UUID REFERENCES clientes(id),
  conversa_id UUID REFERENCES conversas(id),
  receiver_number TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'audio', 'image', 'video', 'document')) DEFAULT 'text',
  text_content TEXT,
  media_url TEXT,
  mime_type TEXT,
  file_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('agendada', 'enviada', 'erro', 'cancelada')) DEFAULT 'agendada',
  created_by UUID REFERENCES usuarios(id),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE mensagens_agendadas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow all for authenticated users" ON mensagens_agendadas FOR ALL USING (true) WITH CHECK (true);

-- 3. Atualizar função de update_at se necessário (opcional)
