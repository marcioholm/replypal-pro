-- Migration 007: Protocolo de Atendimento e viewed_by tracking
-- Adds protocol number to conversas and viewed_by tracking

-- 1. Add protocolo column to conversas (unique sequential number per tenant)
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS protocolo INTEGER;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. Create protocol_sequences table for auto-increment per tenant
CREATE TABLE IF NOT EXISTS protocol_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  last_protocolo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add viewed_by column to historico to track per-user views
ALTER TABLE historico ADD COLUMN IF NOT EXISTS viewed_by TEXT;

-- 4. Function to get next protocol number for a tenant
CREATE OR REPLACE FUNCTION get_next_protocolo(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO protocol_sequences (tenant_id, last_protocolo)
  VALUES (p_tenant_id, 1)
  ON CONFLICT (tenant_id)
  DO UPDATE SET last_protocolo = protocol_sequences.last_protocolo + 1
  RETURNING last_protocolo INTO next_val;
  RETURN next_val;
END;
$$;

-- 5. Assign protocolo to existing conversations that don't have one
DO $$
DECLARE
  r RECORD;
  tenant_protocolo RECORD;
BEGIN
  FOR r IN SELECT id, tenant_id FROM conversas WHERE protocolo IS NULL ORDER BY created_at ASC
  LOOP
    INSERT INTO protocol_sequences (tenant_id, last_protocolo)
    VALUES (r.tenant_id, 1)
    ON CONFLICT (tenant_id)
    DO UPDATE SET last_protocolo = protocol_sequences.last_protocolo + 1
    RETURNING last_protocolo INTO tenant_protocolo.last_protocolo;
    
    UPDATE conversas SET protocolo = tenant_protocolo.last_protocolo WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversas_protocolo ON conversas(tenant_id, protocolo);
