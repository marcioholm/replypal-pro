# Revisão do banco de dados — Conta+ (set/2026)

Feita a partir do repositório (migrations, `supabase-setup.sql`, código do app e das funções `api/`).
As migrations foram executadas numa base Postgres 16 vazia para ver o que quebra.
O banco de produção não foi acessado.

## Resultado de rodar as migrations do zero

| Arquivo | Resultado |
|---|---|
| 001_initial_schema | Falha no seed: ids `'u1'`, `'u2'`, `'u3'` não são UUID. As tabelas são criadas, o seed não. |
| 004_deduplication | Não é idempotente (ADD CONSTRAINT sem IF NOT EXISTS). A 008 repete a mesma constraint. |
| 009_historico… | Falha: usa `conversas.client_avatar` e a tabela `contacts`, que nenhuma migration cria. |
| 20240508_create_ai_history | Falha: `auth.uid_tenant_id()` não existe. |
| 010, 011 | OK e idempotentes. |

Conclusão: **hoje não dá para recriar o banco a partir do repositório.** Parte do schema foi criada à mão no painel do Supabase.

## Tabelas usadas pelo código sem DDL no repositório

`contacts`, `contact_sync_logs`, `message_reactions`, `documentos`, `automacoes_relatorios`, `relatorios_envios_logs`.
Colunas também: `conversas.client_avatar`, `conversas.tags`, `conversas.is_typing`, `usuarios.senha`, `usuarios.whatsapp`.

**Ação:** exportar o schema real de produção (`supabase db dump --schema-only`) e versionar como `000_baseline.sql`.
A partir daí, toda mudança vira migration.

## Duplicidades e conflitos

- **Três fontes de schema** que divergem entre si: `supabase-setup.sql`, `supabase/migrations/*` e scripts em `scripts/_arquivo/`.
  Ex.: `clientes.cnpj` é `UNIQUE` global na 001 (impede dois escritórios de terem o mesmo cliente) e não é no setup; `conversas(client_phone, tenant_id)` é `UNIQUE` só no setup.
- **`contatos` × `contacts`**: `contatos` (contatos do cliente, migration 001) só é lido em `api/sync-avatar.ts`; o app inteiro usa `contacts` (contatos do WhatsApp). Decidir se `contatos` morre ou vira os "contatos por setor" do cliente.
- **`clientes.nome_fantasia` × `clientes.fantasy_name`** (006): mesma informação em duas colunas; o código só usa `nome_fantasia`.
- **Responsável do cliente em quatro lugares**: `responsavel` (texto), `internal_responsible_id/name`, `attendant_id`, `consultant_id`/`supervisor_id`.
  E `internal_responsible_id` aponta para `auth.users`, mas o app não usa o Auth do Supabase — deveria apontar para `usuarios`.
- **Nome do escritório** em `tenants.nome` e `company_settings.nome`.
- **Config da Evolution** em `company_settings`, no `localStorage` e em variáveis de ambiente.
- **`historico.viewed_by`** existe, mas o app registra visualização como texto em `action` ("Visualizado por …").

## Constraints que rejeitam o que o próprio sistema grava (corrigido na 011)

- `mensagens.type` não aceitava `reaction`, `revoke`, `location`, `contact` — por isso o webhook tem um "upsert simplificado" de fallback.
- `usuarios.role` não aceitava `recepcionista`.

## Segurança (não corrigido aqui — depende de migrar o login)

- Quase todas as policies são `USING (true)`: qualquer pessoa com a chave anon (que vai no navegador) lê e altera dados de **todos** os escritórios.
- Algumas tabelas têm RLS desligado (`historico_ia`, `automacoes_alertas`).
- Policies que usam `auth.uid()` nunca funcionam, porque o login é próprio (tabela `usuarios`), não o Supabase Auth.
- Bucket `chat-media` é público, inclusive para **apagar** arquivos.

**Ação recomendada:** migrar o login para Supabase Auth e reescrever as policies por `tenant_id`. É o pré-requisito para vender o Conta+ a outros escritórios.

## Financeiro

- Os lançamentos já eram gravados em `dados_financeiros`; o Google Sheets era só uma exportação via n8n. A exportação foi removida.
- A 011 garante a tabela, validações de mês/ano, índice por período e a view **`vw_financeiro_mensal`** (com nome, CNPJ e regime do cliente) para relatórios.
- **n8n / IA:** trocar o nó do Google Sheets por um nó Postgres/Supabase lendo a view. Exemplo:

```sql
SELECT nome_fantasia, cnpj, competencia, faturamento, compras, vendas, folha_pagamento
FROM vw_financeiro_mensal
WHERE tenant_id = '{{ $json.tenant_id }}'
  AND competencia >= date_trunc('month', now()) - interval '11 months'
ORDER BY nome_fantasia, competencia;
```
