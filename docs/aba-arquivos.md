# Aba "Arquivos" na conversa — especificação

Objetivo: a atendente acha e envia os documentos do cliente sem sair da conversa.
RH, financeiro e certificado digital só para admin e supervisor; os demais pedem
acesso, e um admin/supervisor aprova por algumas horas.

Banco: `supabase/migrations/012_arquivos_e_acesso.sql` (testada numa base limpa).

## Regras

| Área | O que entra | Quem vê e envia |
| --- | --- | --- |
| geral | Pasta do cliente, contrato social, outros | Todos |
| fiscal | Guias, notas, documentos fiscais | Todos |
| cartao_cnpj | Cartão CNPJ | Todos |
| rh | Folha, admissões, pasta de RH | Admin, supervisor ou quem tiver pedido aprovado |
| financeiro | Faturamento, compras, vendas, boletos, pasta financeira | Admin, supervisor ou quem tiver pedido aprovado |
| certificado | Certificado digital | Admin e supervisor veem; **ninguém envia pelo chat** |

- A área de um documento vem de `area_do_documento(categoria, tipo)`; use a view `vw_documentos_cliente`.
- Toda checagem de permissão usa a função `usuario_tem_acesso(usuario, cliente, area)`. Não reimplemente a regra no front.
- Pedido aprovado vale `company_settings.acesso_temporario_horas` (padrão 4 h), só para aquele cliente e aquela área.
- Pedir acesso: `rpc('solicitar_acesso', {p_usuario, p_cliente, p_area, p_motivo, p_conversa})`. Motivo obrigatório (mín. 5 caracteres). Se já houver pedido pendente, a função devolve o mesmo.
- Decidir: `rpc('decidir_solicitacao', {p_solicitacao, p_decisor, p_aprovar, p_resposta})`. A função recusa quem não é admin/supervisor.
- Registrar em `acessos_log` toda vez que alguém: abrir um documento ou link restrito (`visualizou`), enviar no chat (`enviou_no_chat`), lançar faturamento (`lancou_faturamento`), ou tentar abrir sem permissão (`negado_sem_permissao`).

## Tela: aba "Arquivos" no painel da conversa

Nova aba ao lado de Cliente, Notas, Tags e Log (ícone `FolderOpen`).

1. **Sem cliente vinculado**: mensagem "Esta conversa ainda não está ligada a um cliente" e o botão "Vincular cliente", que reaproveita o fluxo existente de vincular/cadastrar.
2. **Atalhos** (`cliente_links`, ordenados por área e `ordem`): um botão por link, com ícone por área. Links restritos sem acesso aparecem com cadeado e o botão "Pedir acesso".
3. **Faturamento do mês** (`vw_faturamento_status_mes`): "Setembro lançado" ou "Setembro pendente". Quem tem acesso vê o valor e o botão "Ver" ou "Lançar", que abre o componente `DadosFinanceiros` num `Sheet` lateral, sem sair da conversa. Sem acesso: só o status + "Pedir acesso".
4. **Documentos recentes** (`vw_documentos_cliente`, últimos 8): nome, tipo, mês/ano e data. Cada um com "Abrir" e "Enviar na conversa". Restritos sem acesso: cadeado + "Pedir acesso". Certificado: sem botão de enviar, com o aviso "Certificado digital não pode ser enviado pelo chat".
5. **Enviar na conversa**: usa o envio de mídia que o chat já tem (mesma função do anexo), com o arquivo baixado da `url` do documento. Registra `enviou_no_chat`.
6. **Cartão CNPJ**: se existir documento `tipo = 'cartao_cnpj'` ou link `area = 'cartao_cnpj'`, usa o mais recente. Se não, botão "Consultar na Receita" que copia o CNPJ e abre a página de consulta da Receita em nova aba.

## Pedido de acesso

- Botão "Pedir acesso" abre um diálogo: área (preenchida), cliente (preenchido), motivo (obrigatório).
- Depois de pedir: o item mostra "Aguardando aprovação".
- Aprovado: o item libera sozinho (escutar `solicitacoes_acesso` pelo realtime) e mostra "Liberado até 15:40".
- Negado: mostra "Pedido negado" + a resposta do aprovador.

## Aprovação (admin e supervisor)

- O sino da barra do topo mostra os pedidos pendentes (realtime em `solicitacoes_acesso`, filtro `tenant_id`).
- Cada pedido: quem pediu, cliente, área, motivo, há quanto tempo. Botões "Aprovar" e "Negar" (negar pede uma resposta curta).
- Em Configurações, uma aba "Acessos" com: tempo de liberação (`acesso_temporario_horas`), pedidos dos últimos 30 dias e o registro `acessos_log` com filtro por cliente e por pessoa.

## Cadastro dos atalhos

Na página do cliente (`CustomerDetailsPage`), uma seção "Atalhos" para admin e supervisor
cadastrarem, editarem e reordenarem `cliente_links` (área, título, URL). Os campos antigos
de Drive do `CustomerForm` passam a gravar em `cliente_links` e deixam de gravar nas
colunas `drive_*` (a migration já copiou os valores existentes).

## Limite conhecido

Enquanto o login não usar o Supabase Auth, o banco não sabe quem está chamando: as
regras organizam o fluxo e deixam registro, mas não impedem um acesso direto à API.
A proteção real vem com a migração para Supabase Auth + RLS por usuário.
Outro ponto: a pasta do Google Drive tem as próprias permissões. Deixe as pastas de RH e
financeiro compartilhadas só com admin e supervisor, senão o cadeado do sistema é só visual.
