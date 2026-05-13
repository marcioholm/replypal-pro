-- Adiciona campos de verificação de WhatsApp à tabela de clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'não verificado',
ADD COLUMN IF NOT EXISTS whatsapp_checked_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_check_provider text,
ADD COLUMN IF NOT EXISTS whatsapp_check_error text;

-- Cria um índice para busca rápida por status
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp_status ON clientes(whatsapp_status);
