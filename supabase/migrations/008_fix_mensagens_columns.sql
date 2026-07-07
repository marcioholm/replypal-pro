-- Migration 008: Add missing columns to mensagens table
-- Columns referenced in code but missing from schema

ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS remote_jid TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS from_me BOOLEAN DEFAULT false;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS participant TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS message_key_json JSONB;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS instance_name TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS reaction TEXT;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS quoted_message JSONB;

-- Add unique constraint on wa_message_id as well (for Evolution API dedup)
CREATE INDEX IF NOT EXISTS idx_mensagens_wa_message_id ON mensagens(wa_message_id);

-- Ensure unique_external_message_id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_external_message_id'
  ) THEN
    ALTER TABLE mensagens ADD CONSTRAINT unique_external_message_id UNIQUE (external_message_id);
  END IF;
END $$;
