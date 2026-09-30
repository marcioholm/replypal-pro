-- 011 — Dados financeiros no banco (fim do Google Sheets) + ajustes de consistência
-- Idempotente: pode rodar mais de uma vez. Não apaga dados.

-- ─────────────────────────────────────────────────────────────
-- 1. Função genérica de updated_at (a do supabase-setup.sql pode não existir)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. dados_financeiros: fonte única de faturamento/compras/vendas/folha
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dados_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  faturamento NUMERIC(15, 2) DEFAULT 0,
  compras NUMERIC(15, 2) DEFAULT 0,
  vendas NUMERIC(15, 2) DEFAULT 0,
  folha_pagamento NUMERIC(15, 2) DEFAULT 0,
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cliente_id, mes, ano)
);

ALTER TABLE public.dados_financeiros ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.dados_financeiros ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dados_financeiros_mes_check') THEN
    ALTER TABLE public.dados_financeiros
      ADD CONSTRAINT dados_financeiros_mes_check CHECK (mes BETWEEN 1 AND 12) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dados_financeiros_ano_check') THEN
    ALTER TABLE public.dados_financeiros
      ADD CONSTRAINT dados_financeiros_ano_check CHECK (ano BETWEEN 2000 AND 2100) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dados_financeiros_tenant_periodo
  ON public.dados_financeiros (tenant_id, ano, mes);

DROP TRIGGER IF EXISTS set_updated_at_dados_financeiros ON public.dados_financeiros;
CREATE TRIGGER set_updated_at_dados_financeiros
  BEFORE UPDATE ON public.dados_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- View para relatórios e para o n8n/IA consultarem direto do banco.
-- Ex.: SELECT * FROM vw_financeiro_mensal WHERE tenant_id = '...' AND competencia >= '2026-01-01';
CREATE OR REPLACE VIEW public.vw_financeiro_mensal AS
SELECT
  f.tenant_id,
  f.cliente_id,
  c.nome_fantasia,
  c.razao_social,
  c.cnpj,
  c.regime_tributario,
  make_date(f.ano, f.mes, 1) AS competencia,
  f.ano,
  f.mes,
  f.faturamento,
  f.compras,
  f.vendas,
  f.folha_pagamento,
  f.observacoes,
  f.updated_at
FROM public.dados_financeiros f
JOIN public.clientes c ON c.id = f.cliente_id;

-- ─────────────────────────────────────────────────────────────
-- 3. Constraints que hoje rejeitam dados que o próprio sistema grava
-- ─────────────────────────────────────────────────────────────

-- mensagens.type: o webhook grava 'reaction', 'revoke', 'location', 'contact',
-- que a CHECK da migration 002 não aceitava (daí o "upsert simplificado" de fallback).
ALTER TABLE public.mensagens DROP CONSTRAINT IF EXISTS mensagens_type_check;
ALTER TABLE public.mensagens ADD CONSTRAINT mensagens_type_check CHECK (
  type IN ('text', 'audio', 'image', 'video', 'document', 'sticker',
           'reaction', 'revoke', 'location', 'contact')
) NOT VALID;

-- usuarios.role: o app usa 'recepcionista', que a CHECK da migration 001 não aceitava.
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check CHECK (
  role IN ('admin', 'supervisor', 'atendente', 'recepcionista')
) NOT VALID;

-- ─────────────────────────────────────────────────────────────
-- 4. Índices para as consultas mais frequentes do app
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mensagens_conversation_ts ON public.mensagens (conversation_id, "timestamp");
CREATE INDEX IF NOT EXISTS idx_conversas_tenant_status ON public.conversas (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_historico_conversation ON public.historico (conversation_id, "timestamp" DESC);
