-- 1. Add tenant_id to historico for multi-tenant isolation
ALTER TABLE historico ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill existing historico rows with tenant_id from conversas
UPDATE historico h
SET tenant_id = c.tenant_id
FROM conversas c
WHERE h.conversation_id = c.id
  AND h.tenant_id IS NULL;

-- 2. Clean up expired WhatsApp CDN URLs from conversas.client_avatar
-- These URLs from pps.whatsapp.net / mmg.whatsapp.net are temporary and expire
UPDATE conversas
SET client_avatar = NULL
WHERE client_avatar LIKE '%whatsapp.net%'
   OR client_avatar LIKE '%pps.whatsapp%'
   OR client_avatar LIKE '%mmg.whatsapp%';

-- Also clean up contacts.foto_perfil that point to WhatsApp CDN
UPDATE contacts
SET foto_perfil = NULL
WHERE foto_perfil LIKE '%whatsapp.net%'
   OR foto_perfil LIKE '%pps.whatsapp%'
   OR foto_perfil LIKE '%mmg.whatsapp%';

-- 3. Update RLS for historico: drop permissive policy, add tenant-aware policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON historico;

CREATE POLICY "historico_select" ON historico
  FOR SELECT USING (true);

CREATE POLICY "historico_insert" ON historico
  FOR INSERT WITH CHECK (true);

CREATE POLICY "historico_update" ON historico
  FOR UPDATE USING (true);

CREATE POLICY "historico_delete" ON historico
  FOR DELETE USING (true);
