# Cliente pede documento no WhatsApp — especificação

O cliente escreve "me manda o contrato social" e o Conta+ resolve: envia sozinho, deixa
pronto para a atendente enviar com um clique ou pede aprovação do admin, conforme o tipo.

Banco: `supabase/migrations/013_envio_documentos_whatsapp.sql` (depende da 012; testada numa
base limpa, incluindo o fluxo completo de cada nível).

## Níveis (padrão; o escritório muda em Configurações)

| Documento (`tipo`) | Nível padrão | Observação |
| --- | --- | --- |
| Cartão CNPJ (`cartao_cnpj`) | Automático | |
| Alvará (`alvara`) | Automático | |
| Guias e documentos fiscais (`documentos_fiscais`) | Automático | Só competência deste mês ou do anterior |
| Boleto de honorários (`boletos_honorarios`) | Automático | Só competência deste mês ou do anterior |
| Contrato social (`contrato_social`) | Um clique | Só a versão vigente |
| Folha de pagamento (`folha_pagamento`) | Um clique | Área RH: quem envia precisa de acesso (regra da 012) |
| Faturamento, compras, vendas | Um clique | Área financeiro: quem envia precisa de acesso |
| Certificado digital (`certificado_digital`) | Aprovação do admin | O banco proíbe "automático" e "um clique" para certificado |

## Quem pode receber

Só quem é **contato cadastrado da empresa** (tabela `contatos`) com **"Pode receber documentos"**
marcado. Certificado exige também **"Pode receber certificado"**. O número é comparado pelo DDD
+ últimos 8 dígitos (resolve +55 e o 9 extra). Contato de empresa inativa ou encerrada não recebe.

**Bug atual a corrigir junto:** os contatos do cadastro do cliente (`CustomerForm`) não são
gravados no banco hoje; só ficam na memória da tela. Eles passam a ser gravados em `contatos`
(colunas: `customer_id`, `tenant_id`, `nome`, `role`, `telefone`, `whatsapp`, `email`,
`pode_receber_documentos`, `pode_receber_certificado`). Só admin pode marcar
"Pode receber certificado".

## Fluxo da conversa

1. Chega mensagem do cliente. Se `company_settings.bot_documentos_ativo` = false, nada acontece.
2. **Há pedido aberto deste telefone** (`pedidos_documento` com status `aguardando_cliente` ou
   `escolher_empresa`, criado há menos de 15 min)?
   - Resposta "1", "sim", "isso", "pode": `rpc confirmar_pedido_documento(pedido)`.
   - Resposta "2", "não": marcar o pedido como `cancelado` e responder "Tudo bem!".
   - Resposta com número da lista de empresas: `rpc resolver_pedido_documento(..., p_cliente)` com a empresa escolhida.
3. **Filtro barato antes da IA**: só chama a IA se o texto tiver uma destas palavras: contrato,
   social, cartão, cartao, cnpj, certificado, guia, das, boleto, honorário, folha, holerite,
   alvará, alvara, faturamento, compras, vendas.
4. **IA classifica** (GPT do n8n, resposta em JSON): `{"pedido": true|false, "tipo": "<um dos tipos da tabela>"|null}`.
   Pergunta sobre o documento ("o contrato precisa de alteração?") é `pedido: false`.
5. `rpc resolver_pedido_documento(tenant, telefone, tipo, conversa, mensagem)` e responder conforme `decisao`:

| decisao | Resposta do bot |
| --- | --- |
| `confirmar_com_cliente` | "Você quer receber o {rotulo} da {empresa}? Responda 1 para sim ou 2 para não." |
| `escolher_empresa` | "De qual empresa?" + lista numerada de `empresas` |
| `nao_autorizado` | "Não encontrei seu cadastro para receber documentos por aqui. Um atendente já vai te ajudar." |
| `sem_documento` | "Não achei esse documento no sistema. Um atendente já vai te ajudar." |
| `bloqueado` | "Esse documento é tratado só com a nossa equipe. Um atendente já vai te ajudar." |

6. Depois do "sim", `confirmar_pedido_documento` devolve `acao`:

| acao | O que fazer |
| --- | --- |
| `enviar_agora` | Enviar o arquivo (`documento.url`) pela Evolution como documento, depois `rpc marcar_pedido_enviado(pedido, null)` |
| `avisar_equipe` | Responder "Pedido recebido! A equipe envia em instantes." O pedido aparece na conversa para a atendente |
| `aguardar_aprovacao` | Responder "Esse documento precisa de uma aprovação interna. Avisamos por aqui assim que for liberado." |

7. Toda mensagem do bot é gravada em `mensagens` (sender `agent`, sender_name `Conta+ (automático)`) para aparecer no chat.

Onde roda: o `api/evolution-webhook.ts` já recebe as mensagens. Depois de gravar uma mensagem de
texto recebida, ele chama (sem esperar) um webhook novo do n8n `conta/documentos` com
`{tenant_id, conversa_id, telefone, texto}`. O n8n faz os passos 2 a 7. O endereço do webhook
vai em variável de ambiente `N8N_DOCUMENTOS_WEBHOOK`.

## Telas

**Conversa (um clique):** quando a conversa tem pedido `aguardando_envio`, aparece uma faixa no
topo do chat: "Sônia (Sócia) pediu: Contrato social · contrato.pdf  [Enviar] [Recusar]".
Enviar usa o envio de mídia que o chat já tem e chama `marcar_pedido_enviado(pedido, usuario)`.
Se a pessoa não tem acesso à área (RH, financeiro), o botão vira "Pedir acesso" (fluxo da 012).
Na Caixa de Entrada, conversas com pedido pendente ganham o chip "Pediu documento".

**Aprovação de certificado (só admin):** o sino mostra o pedido com: empresa, contato, papel,
quando o contato foi cadastrado e a mensagem original do cliente. Para aprovar, o admin
**digita o nome da empresa** (o "tem certeza?" de verdade; o banco confere). Aprovado,
`decidir_envio_certificado` devolve um `token`; o app envia na conversa:
"Segue o link para baixar o certificado digital da {empresa}: {URL}/api/baixar/{token}
Ele vale por 24 horas e para um único download. A senha será informada por telefone."
e chama `marcar_pedido_enviado(pedido, admin)`. **A senha do certificado nunca é enviada pelo sistema.**

**Rota `api/baixar/[token].ts`:** chama `usar_link_download(token)` com a chave de serviço; se
`ok`, redireciona para o arquivo (se o arquivo estiver no Storage privado, gerar URL assinada de
5 minutos). Se não, uma página simples: "Este link expirou ou já foi usado. Fale com o escritório."

**Configurações › Documentos automáticos (admin):** liga/desliga `bot_documentos_ativo`; tabela
dos tipos com o nível (certificado só oferece "Aprovação do admin" e "Nunca"); lista dos pedidos
dos últimos 30 dias com status.

**Cadastro de documentos:** o formulário de upload ganha os tipos "Cartão CNPJ" e "Alvará". Ao
subir um contrato social novo, perguntar "Substituir a versão vigente?" e marcar o anterior com
`vigente = false`.

## Antes de ligar

- Marcar "Pode receber documentos" nos sócios e responsáveis de cada cliente; sem isso o bot responde "não autorizado" para todo mundo.
- Ligar `bot_documentos_ativo` primeiro só para o próprio escritório testar com números internos.
- Revisar `acessos_log` na primeira semana.
- Mesmo limite da 012: enquanto o login não usar Supabase Auth, as regras organizam e registram, mas não blindam a API.
