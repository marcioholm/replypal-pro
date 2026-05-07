
-- Prevent duplicate messages from Evolution API
ALTER TABLE mensagens ADD CONSTRAINT unique_external_message_id UNIQUE (external_message_id);

-- Optional: Index for better performance on status updates
CREATE INDEX IF NOT EXISTS idx_mensagens_external_id ON mensagens(external_message_id);
