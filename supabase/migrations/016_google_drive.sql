-- ════════════════════════════════════════════════════════════════════════════
-- 016 · Google Drive do escritório
--
-- O escritório conecta a própria conta Google. O Conta+ só enxerga o que ele
-- mesmo criar (escopo drive.file): a pasta "Conta+", as pastas de cada cliente
-- e os documentos enviados pelo sistema.
--
--   Conta+/Clientes/<CNPJ - Nome>/<Área>/<AAAA-MM>/<arquivo>
--
-- O banco é o índice (cliente, tipo, mês, id do arquivo); o Drive é o depósito.
-- O certificado digital NÃO vai para o Drive: fica no Storage privado.
--
-- Idempotente: pode rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Conexão por escritório. Só o servidor (service_role) lê esta tabela:
--    RLS ligado e nenhuma policy = a chave pública do app não enxerga nada.
--    O refresh token é gravado cifrado (AES-256-GCM) pelo /api/google.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integracoes_google (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  google_email TEXT,
  refresh_token_cifrado TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,   -- false = desconectado (guarda e-mail e pastas para reconectar)
  pasta_raiz_id TEXT,        -- "Conta+"
  pasta_clientes_id TEXT,    -- "Conta+/Clientes"
  conectado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  conectado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_erro TEXT,
  ultimo_erro_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integracoes_google ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.integracoes_google ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integracoes_google FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Pastas já criadas no Drive (evita procurar/criar de novo a cada envio)
--    chave = 'cliente:<uuid>' | 'cliente:<uuid>/Fiscal' | 'cliente:<uuid>/Fiscal/2026-10'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drive_pastas (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  pasta_id TEXT NOT NULL,
  nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, chave)
);
ALTER TABLE public.drive_pastas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_pastas FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Documentos: onde o arquivo está
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tamanho_bytes BIGINT;
CREATE INDEX IF NOT EXISTS idx_documentos_drive_file ON public.documentos (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- A view usa d.* (congelado na criação): recria para incluir drive_file_id.
DROP VIEW IF EXISTS public.vw_documentos_cliente;
CREATE VIEW public.vw_documentos_cliente AS
SELECT
  d.*,
  public.area_do_documento(d.categoria, d.tipo) AS area,
  public.area_restrita(public.area_do_documento(d.categoria, d.tipo)) AS restrito
FROM public.documentos d;

-- ─────────────────────────────────────────────────────────────
-- 4. Padrão de nomes (o mesmo raciocínio do Storage: cliente / área / mês)
-- ─────────────────────────────────────────────────────────────
-- Nome da pasta de cada área. NULL = não vai para o Drive.
CREATE OR REPLACE FUNCTION public.pasta_da_area(p_area text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_area
    WHEN 'fiscal'      THEN 'Fiscal'
    WHEN 'financeiro'  THEN 'Financeiro'
    WHEN 'rh'          THEN 'RH'
    WHEN 'cartao_cnpj' THEN 'Empresa'
    WHEN 'geral'       THEN 'Empresa'
    WHEN 'certificado' THEN NULL
    ELSE 'Empresa'
  END
$$;

-- Nome da pasta do cliente: "12.345.678/0001-90 - Padaria X" (sem / nem \, que o Drive aceita
-- mas confundem em exportações).
CREATE OR REPLACE FUNCTION public.pasta_do_cliente(p_cliente uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT left(
    regexp_replace(
      trim(both ' -' from
        coalesce(nullif(trim(c.cnpj), ''), '') || ' - ' ||
        coalesce(nullif(trim(c.nome_fantasia), ''), nullif(trim(c.razao_social), ''), 'Cliente')
      ),
      '[/\\]+', '-', 'g'),
    120)
  FROM public.clientes c WHERE c.id = p_cliente
$$;

-- Tudo que o /api/google precisa para decidir onde gravar um documento.
CREATE OR REPLACE FUNCTION public.drive_destino(
  p_cliente uuid, p_categoria text, p_tipo text, p_mes int, p_ano int
) RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'tenant_id', c.tenant_id,
    'area', a.area,
    'restrito', public.area_restrita(a.area),
    'pasta_cliente', public.pasta_do_cliente(c.id),
    'pasta_area', public.pasta_da_area(a.area),
    'pasta_mes', CASE
      WHEN p_ano IS NOT NULL AND p_mes BETWEEN 1 AND 12
        THEN p_ano::text || '-' || lpad(p_mes::text, 2, '0')
      ELSE NULL END,
    'vai_para_drive', public.pasta_da_area(a.area) IS NOT NULL
  )
  FROM public.clientes c
  CROSS JOIN LATERAL (SELECT public.area_do_documento(p_categoria, p_tipo) AS area) a
  WHERE c.id = p_cliente
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Situação da conexão para a tela (sem expor o token)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.google_drive_status(p_tenant uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
        'conectado', true,
        'email', g.google_email,
        'conectado_em', g.conectado_em,
        'ultimo_erro', g.ultimo_erro,
        'ultimo_erro_em', g.ultimo_erro_em,
        'documentos_no_drive', (SELECT count(*) FROM public.documentos d
                                 WHERE d.tenant_id = p_tenant AND d.drive_file_id IS NOT NULL))
       FROM public.integracoes_google g WHERE g.tenant_id = p_tenant AND g.ativo),
    jsonb_build_object('conectado', false))
$$;
GRANT EXECUTE ON FUNCTION public.google_drive_status(uuid) TO anon, authenticated;
