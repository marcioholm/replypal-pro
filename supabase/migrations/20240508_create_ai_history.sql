-- Migration: Create IA Chat History table
CREATE TABLE IF NOT EXISTS public.historico_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' ou 'ia'
    content TEXT NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ativar RLS
ALTER TABLE public.historico_ia ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seu próprio histórico (dentro do seu tenant)
CREATE POLICY "Usuários vêem seu próprio histórico da IA" ON public.historico_ia
    FOR ALL USING (tenant_id = auth.uid_tenant_id() AND user_id = auth.uid());

-- Desabilitar RLS se necessário (seguindo o padrão do setup-sql para evitar bloqueios iniciais)
ALTER TABLE public.historico_ia DISABLE ROW LEVEL SECURITY;
