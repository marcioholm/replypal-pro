# Triagem, Pré-venda e Atendimento — especificação

Banco: `supabase/migrations/014_funis_triagem_prevenda.sql` (depende de 011–013; testada numa
base limpa: classificação automática, vínculo, pré-venda, ganho, perda, arquivamento e permissões).

## Regra

Toda conversa está em um funil (`conversas.funil`), decidido pelo banco:

| Funil | Quando | Quem vê |
| --- | --- | --- |
| `triagem` | Número sem cliente vinculado (e não deu para vincular sozinho) | Todos |
| `atendimento` | Conversa ligada a um cliente, ou grupo | Todos |
| `pre_venda` | Alguém marcou como possível cliente | Só admin e supervisor |
| `arquivado` | Não é cliente nem lead (fornecedor, pessoal, spam, lead perdido, antigo) | Admin e supervisor, no filtro "Arquivadas" |

- Conversa nova: o gatilho procura o telefone no WhatsApp dos clientes e na tabela `contatos`.
  Achou **um** cliente: vincula e manda para Atendimento. Achou mais de um ou nenhum: Triagem.
- Ao vincular uma conversa a um cliente, o telefone vira contato da empresa: da próxima vez o vínculo é automático.
- Ao rodar a migration: conversas com cliente vão para Atendimento; sem cliente e com mensagem nos
  últimos 30 dias vão para Triagem; as mais antigas são arquivadas como "antigo" (dá para reabrir).
  **Espere uma Triagem cheia no primeiro dia**: é a faxina dos números que nunca foram vinculados.

## Ações (sempre pelas funções do banco)

| Ação | Função | Quem |
| --- | --- | --- |
| Vincular a cliente | `vincular_conversa_cliente(conversa, cliente, usuario, nome_contato?, papel?)` | Todos |
| É possível cliente | `enviar_para_pre_venda(conversa, usuario, empresa?, origem?, observacao?)` | Todos (só encaminha) |
| Não é cliente | `arquivar_conversa(conversa, usuario, motivo)` | Todos |
| Reabrir arquivada | `reabrir_conversa(conversa, usuario)` | Admin e supervisor |
| Mudar etapa da oportunidade | `mover_oportunidade(oportunidade, usuario, etapa, cliente?, motivo_perda?)` | Admin e supervisor |

Motivos de arquivo: `funcionario_de_cliente`, `fornecedor`, `parceiro`, `pessoal`, `spam`, `outro`
(`antigo` e `lead_perdido` são do sistema). "Funcionário de cliente" deveria quase sempre ser
"Vincular a cliente"; mostre essa dica no diálogo.

## Pré-venda

Etapas (`oportunidades.etapa`): **Novo lead → Qualificação → Proposta enviada → Negociação →
Ganho / Perdido**.

- **Ganho** exige escolher ou cadastrar o cliente (abre o `CustomerForm` já preenchido com nome,
  telefone e empresa da oportunidade). A função liga a conversa ao cliente e ela vai para Atendimento.
- **Perdido** exige o motivo: preço, ficou com o contador atual, sem resposta, não era o momento,
  serviço que não atendemos, outro. A conversa é arquivada como `lead_perdido`.
- Campos da oportunidade: nome do contato, empresa, CNPJ (se tiver), regime pretendido, serviços de
  interesse, colaboradores, valor mensal estimado, origem (WhatsApp, indicação, site, Instagram,
  Empreenda Hub, evento, outro), responsável, próximo passo, data do próximo contato, observações.
- `oportunidade_eventos` guarda cada mudança de etapa (gatilho); `vw_funil_pre_venda` e
  `vw_tempo_por_etapa` dão os números do funil.

## Telas

**Menu lateral (grupo Atendimento):**

- "Triagem", com contador, para todos
- "Caixa de Entrada" passa a mostrar só `funil = 'atendimento'`
- "Pré-venda", só admin e supervisor
- "Pipeline" vira o quadro de Atendimento (só `funil = 'atendimento'`), com as colunas Novo,
  Aguardando atendimento (`aguardando_aceite`), Em atendimento, Aguardando cliente e Resolvido

**Triagem (`/triagem`):** lista igual à Caixa de Entrada, mais antigas primeiro. Cada linha tem três
botões: "Vincular a cliente" (busca por nome/CNPJ + "Cadastrar novo"), "Possível cliente" (pede o
nome da empresa, opcional) e "Não é cliente" (motivo). Clicar na linha abre a conversa.

**Conversa em triagem:** faixa no topo do chat: "Este número não está ligado a nenhum cliente" com
os mesmos três botões. O painel lateral mostra a aba Cliente vazia com "Vincular".

**Pré-venda (`/pre-venda`, admin e supervisor):**

- Quadro com as 4 colunas abertas (Novo lead, Qualificação, Proposta enviada, Negociação) e,
  à direita, os totais de Ganho e Perdido nos últimos 90 dias
- Card: nome, empresa, valor mensal estimado, chip de origem, data do próximo contato
  (vermelha se atrasada), botão para abrir a conversa
- Arrastar entre colunas chama `mover_oportunidade`. Soltar em Ganho abre o cadastro do cliente;
  em Perdido, o motivo
- Clicar no card abre um painel lateral com todos os campos editáveis
- Topo do quadro: leads abertos, valor mensal em negociação, conversão dos últimos 90 dias
  (ganhos ÷ encerrados) e tempo médio por etapa (`vw_tempo_por_etapa`)

**Conversa em pré-venda:** chip "Pré-venda · {etapa}" no cabeçalho e um bloco no painel lateral com
a oportunidade (etapa, valor, próximo contato). Atendente que abrir o link vê "Conversa restrita à
pré-venda".

**Início:** novo indicador "Na triagem". Para admin e supervisor, um bloco "Pré-venda" com leads
abertos e os próximos contatos do dia.

**Notificações:** mensagem nova em Triagem avisa todos; em Pré-venda, só admin e supervisor; em
Arquivado, ninguém.

## Código que precisa conhecer o funil

`Conversation` em `src/lib/store.ts` ganha `funil` e `arquivoMotivo`. Todo lugar que lê `conversas`
precisa mapear: `InboxPage`, `HomePage`, `ChatPage`, `PipelinePage`, `AppSidebar` (hidratação),
`useRealtimeChat`, `NotificationManager`, `GlobalSearch`. O `api/evolution-webhook.ts` não muda:
o gatilho do banco classifica.

## Limite conhecido

Mesmo das migrations 012 e 013: enquanto o login não usar Supabase Auth, "só admin e supervisor
veem a pré-venda" é organização de tela, não bloqueio da API.
