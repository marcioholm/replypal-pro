# Fluxos n8n do Conta+

São 8 fluxos, um para cada etapa que o sistema entrega ao n8n. Todos foram importados
e executados de ponta a ponta num n8n 1.112 com o banco de teste (migrations 010–015)
e uma Evolution/OpenAI/Storage simuladas.

| # | Arquivo | Dispara por | O que faz |
|---|---------|-------------|-----------|
| 01 | `01-assistente-ia.json` | Webhook `POST /webhook/replypal/ia-pro` (botão Assistente Conta+) | IA classifica a pergunta → `ia_contexto()` busca os dados do escritório → IA responde só com esses dados → `{ resposta }` |
| 02 | `02-upload-documentos.json` | Webhook `POST /webhook/documentos/upload` (aba Documentos do cliente) | Valida, grava o arquivo no bucket **privado** `documentos` e registra em `documentos` com `storage_path` |
| 03 | `03-pedido-documentos-whatsapp.json` | Webhook `POST /webhook/conta/documentos` (chamado pelo `api/evolution-webhook`) | Cliente pede documento no WhatsApp → IA entende → regras do banco decidem (automático / um clique / aprovação do admin) → envia link assinado ou avisa |
| 04 | `04-mensagens-agendadas.json` | A cada minuto | Envia as mensagens agendadas vencidas, com trava contra envio duplo e até 3 tentativas |
| 05 | `05-alertas-atendimento.json` | A cada 15 minutos | Avisa a gestão quando um cliente está sem resposta além do limite configurado |
| 06 | `06-relatorio-diario.json` | A cada 5 min + webhook `POST /webhook/replypal/relatorio-atendimento/teste` | Relatório diário no horário configurado; o botão **Testar** envia na hora |
| 07 | `07-eventos-sistema.json` | Webhook `POST /webhook/conta/eventos` | Cliente cadastrado → avisa admin/supervisores no WhatsApp |
| 08 | `08-lembretes-pre-venda.json` | Seg a sex, 8h | Lista para cada responsável os leads da pré-venda com próximo passo para hoje ou atrasado |

Regra de ouro: **a IA nunca escreve SQL**. Ela só classifica texto. Quem decide o que
pode ser enviado, para quem, e quais dados existem são as funções do banco.

## 1. Antes de importar

1. Rode a migration `supabase/migrations/015_automacoes_n8n.sql` no SQL Editor do Supabase
   (depois da 010–014). Ela é idempotente: pode rodar de novo sem problema.
2. Confirme que o bucket `documentos` ficou **privado** (Storage › documentos › não público).

## 2. Credenciais no n8n (criar uma vez)

| Nome exato | Tipo no n8n | Valores |
|------------|-------------|---------|
| `Conta+ · Supabase (Postgres)` | Postgres | Supabase › Project Settings › Database › Connection pooling (Session, porta 5432). Host `aws-0-…pooler.supabase.com`, usuário `postgres.<ref>`, senha do banco, SSL **require** |
| `Conta+ · OpenAI` | Header Auth | Name `Authorization`, Value `Bearer sk-…` |
| `Conta+ · API interna` | Header Auth | Name `x-conta-key`, Value = o mesmo texto de `CONTA_INTERNAL_KEY` na Vercel (usada pelo fluxo 03) |
| `Conta+ · Supabase service` | Custom Auth | `{"headers":{"apikey":"<service_role>","Authorization":"Bearer <service_role>"}}` |

Ao importar, se o n8n mostrar a credencial em vermelho, abra o nó e selecione a credencial
com o mesmo nome. Ela só precisa ser escolhida uma vez por fluxo.

## 3. Importar e configurar

1. n8n › Workflows › **Import from file**, um arquivo por vez (01 a 08).
2. Em cada fluxo, abra o nó **Config** e preencha:
   - `SUPABASE_URL`: `https://<ref>.supabase.co`, sem barra no final.
   - `APP_URL`: endereço do Conta+ (`https://<seu-app>`), sem barra no final.
   - `EVOLUTION_V1`: `false` para Evolution v2 (padrão). Use `true` só se for v1.x.
   - `MODELO_IA`: `gpt-4.1-mini` (pode trocar).
3. URL, apikey e instância da Evolution **não** ficam no n8n. Elas vêm de
   `company_settings` de cada escritório (função `evolution_config`), então o mesmo fluxo
   atende vários escritórios.

## 4. Variáveis na Vercel

| Variável | Valor |
|----------|-------|
| `VITE_N8N_BASE_URL` | `https://<seu-n8n>` (sem barra). O app monta as URLs dos webhooks 01, 02, 06 e 07 a partir dela |
| `N8N_DOCUMENTOS_WEBHOOK` | `https://<seu-n8n>/webhook/conta/documentos` (fluxo 03). Sem ela, o bot de documentos fica desligado |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Usadas por `/api/documento-url` para gerar links assinados |
| `CONTA_INTERNAL_KEY` | Texto aleatório longo. O fluxo 03 usa para pedir ao Conta+ o link do arquivo (Drive ou Storage) |
| `N8N_ALLOWED_HOSTS` | Opcional: outros hosts do n8n aceitos pelo `/api/proxy-webhook` |

Depois de mudar variáveis `VITE_*`, faça um novo deploy (elas entram no build).

## 5. Ordem para ativar e testar

| Ordem | Fluxo | Como testar |
|-------|-------|-------------|
| 1 | 04 Agendadas | Agende uma mensagem para daqui a 2 min. Ela deve chegar no WhatsApp e ficar como *enviada* em Agendamentos |
| 2 | 01 Assistente | Abra o Assistente Conta+ e pergunte "quantos clientes temos?" |
| 3 | 02 Upload | Suba um PDF pequeno num cliente. Ele deve abrir pelo botão Visualizar (link assinado de 5 min) |
| 4 | 07 Eventos | Cadastre um cliente de teste. Admin/supervisor com WhatsApp no perfil recebem o aviso |
| 5 | 06 Relatório | Configurações › Relatório diário › **Testar** |
| 6 | 05 Alertas | Ative um alerta com limite de 1 h numa conversa de teste |
| 7 | 08 Pré-venda | Crie um lead com próximo passo para hoje. Para não esperar as 8h, use "Execute workflow" |
| 8 | 03 Pedido de documentos | Ligue o bot em Configurações, cadastre seu número como contato autorizado de um cliente e mande "me manda o cartão CNPJ" |

## 6. Bom saber

- Execuções com sucesso **não** são salvas (os fluxos 04/05/06 rodam o tempo todo). Os erros
  são salvos. Para depurar, mude em *Settings* do fluxo.
- Upload pelo app: limite de **3 MB** por arquivo, porque o envio passa pelo
  `/api/proxy-webhook` da Vercel (máx. ~4,5 MB por requisição, e base64 aumenta 33%).
- O fluxo 03 só responde mensagens que parecem pedido de documento ou que respondem a um
  pedido aberto (1/2, número da empresa). O resto segue para a equipe normalmente.
- Mensagens do bot são gravadas como `Conta+ (automático)` e **não contam** como resposta
  humana nos alertas nem no tempo de primeira resposta.
- O fluxo 03 não sabe onde o arquivo está: pede o link ao Conta+ (`/api/documento-url`), que
  devolve um link de 5 minutos do Google Drive do escritório ou do Storage. Se não houver
  link (arquivo apagado, Drive desconectado), o cliente é avisado e o pedido vai para a fila
  de "um clique" da equipe. Detalhes em `docs/google-drive.md`.
- Com o Drive conectado, o upload pelo app vai direto para o Drive e o fluxo 02 só é usado
  para o certificado digital e para escritórios sem Drive.
- Para alterar os fluxos, edite `gerar_fluxos.py` e rode `python3 n8n/gerar_fluxos.py`.
  Os JSONs são gerados a partir dele.
