-- Adiciona campos específicos para rotina contábil na tabela de clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS operational_status text DEFAULT 'Revisão pendente',
ADD COLUMN IF NOT EXISTS internal_responsible_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS internal_responsible_name text,
ADD COLUMN IF NOT EXISTS sector text,
ADD COLUMN IF NOT EXISTS fantasy_name text;

-- Cria índices para os novos campos de filtro
CREATE INDEX IF NOT EXISTS idx_clientes_operational_status ON clientes(operational_status);
CREATE INDEX IF NOT EXISTS idx_clientes_sector ON clientes(sector);
CREATE INDEX IF NOT EXISTS idx_clientes_internal_responsible ON clientes(internal_responsible_id);
