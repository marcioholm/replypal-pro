-- Migration: Create Intelligent Alerts table
CREATE TABLE IF NOT EXISTS public.automacoes_alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'cliente_sem_resposta',
    ativo BOOLEAN NOT NULL DEFAULT false,
    limite_horas_sem_resposta INTEGER NOT NULL DEFAULT 48,
    numero_destino TEXT,
    dias_semana JSONB NOT NULL DEFAULT '["1","2","3","4","5"]',
    horario_inicio TEXT DEFAULT '08:00',
    horario_fim TEXT DEFAULT '18:00',
    mensagem_template TEXT DEFAULT '⚠️ ALERTA DE ATENDIMENTO\n\nO cliente {cliente_nome} está há {horas_sem_resposta} horas sem resposta do colaborador.\n\nResponsável: {responsavel_nome}\nStatus: {status}\nAberto em: {created_at}\n\nRecomendação: verificar o atendimento e priorizar retorno.',
    configuracao JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.automacoes_alertas ENABLE ROW LEVEL SECURITY;

-- Policy for tenant access
CREATE POLICY "Tenant access automacoes_alertas" ON public.automacoes_alertas
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM usuarios WHERE id = auth.uid()));

-- Disable RLS for now to match project pattern
ALTER TABLE public.automacoes_alertas DISABLE ROW LEVEL SECURITY;
