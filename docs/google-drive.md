# Google Drive do escritório

O escritório conecta a própria conta Google e os documentos dos clientes passam a ficar
no Drive dele. O Conta+ pede só a permissão `drive.file`: **enxerga apenas as pastas e
os arquivos que ele mesmo criou**. Nada do que já existe no Drive do escritório é lido.

```
Conta+/
  Clientes/
    12.345.678-0001-90 - Padaria Pão Nosso/
      Fiscal/2026-10/DAS outubro.pdf
      Financeiro/2026-10/...
      RH/2026-10/...
      Empresa/Cartão CNPJ.pdf
```

- A pasta do cliente nasce no cadastro; a da área e a do mês, no primeiro documento.
- O banco é o índice (cliente, tipo, mês, id do arquivo). O Drive é só o depósito.
- **Certificado digital não vai para o Drive.** Continua no Storage privado, com aprovação do admin.
- Quem joga um arquivo direto na pasta pelo Drive: o Conta+ não vê. Os documentos entram pelo sistema.

## O que acontece quando...

| Situação | Comportamento |
|----------|---------------|
| Alguém renomeia ou move o arquivo no Drive | Continua abrindo (o Conta+ guarda o id, não o caminho) |
| Alguém apaga o arquivo | "Arquivo não encontrado no Drive" ao abrir; o pedido pelo WhatsApp vai para a fila da equipe |
| Alguém apaga uma pasta (ou manda para a lixeira) | No próximo envio o Conta+ recria só o que falta |
| Drive sem espaço | O envio falha com aviso claro e o erro aparece em Configurações |
| Escritório remove o acesso do Conta+ na conta Google | Aviso em Configurações pedindo para conectar de novo |
| Desconectar e conectar a **mesma** conta | Continua nas mesmas pastas |
| Conectar **outra** conta | Começa uma estrutura nova; os documentos da conta anterior deixam de abrir |
| Drive não conectado | Tudo funciona como antes (upload pelo n8n para o Storage) |

## Configurar (uma vez)

### 1. Google Cloud

1. https://console.cloud.google.com › crie um projeto (ex.: `Conta Mais`).
2. **APIs e serviços › Biblioteca** › ative **Google Drive API**.
3. **APIs e serviços › Tela de permissão OAuth**:
   - Tipo de usuário: **Externo**.
   - Nome do app, e-mail de suporte, logo.
   - Domínios autorizados: o domínio do Conta+.
   - Links da página inicial e da política de privacidade (já existe em `/privacidade`).
   - Escopos: adicione `.../auth/drive.file` (não sensível), além de `openid` e `email`.
4. **Publique o app** (status "Em produção"). Em "Teste" o Google derruba a conexão a cada 7 dias.
5. **Credenciais › Criar credenciais › ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - URI de redirecionamento autorizado: `https://SEU-APP/api/google` (exatamente assim, sem barra no fim).
   - Guarde o **ID do cliente** e a **chave secreta**.

### 2. Vercel (Settings › Environment Variables)

| Variável | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth |
| `GOOGLE_CLIENT_SECRET` | chave secreta do cliente |
| `CONTA_SECRET` | texto aleatório longo (32+ caracteres). Assina os links e cifra o token do Google. **Não troque depois**: trocar invalida as conexões existentes |
| `CONTA_INTERNAL_KEY` | outro texto aleatório longo. É a senha que o n8n usa para pedir links ao Conta+ |
| `APP_URL` | `https://SEU-APP` (sem barra). Tem que bater com o URI de redirecionamento |

Depois, **Redeploy**.

### 3. Banco

Rode `supabase/migrations/016_google_drive.sql` no SQL Editor (depois da 015).

### 4. n8n

No fluxo 03 (pedido de documentos):

- Nó **Config**: preencha `APP_URL`.
- Credencial nova **`Conta+ · API interna`** (Header Auth): Name `x-conta-key`, Value = `CONTA_INTERNAL_KEY`.

### 5. Conectar

Conta+ › Configurações › **Documentos e Drive** › **Conectar Google Drive** (só admin).
O Google mostra a tela de permissão; ao voltar, as pastas `Conta+/Clientes` já existem.

## Segurança

- O token do Google fica na tabela `integracoes_google`, cifrado (AES-256-GCM com `CONTA_SECRET`).
  A tabela tem RLS ligado e nenhuma policy: a chave pública do app não lê nada dali.
- Abrir e enviar documento usa um link assinado de 5 minutos (`/api/google?action=arquivo`),
  que entrega o arquivo sem exigir login no Google. Áreas restritas (RH, financeiro)
  continuam passando por `usuario_tem_acesso`.
- No Drive em si, quem entra na conta Google do escritório vê todas as pastas. A restrição
  de RH/financeiro vale dentro do Conta+.

## Limites

- 3 MB por arquivo (limite de requisição da Vercel).
- Documentos que já estavam no Storage continuam lá e continuam abrindo. Não há migração automática.
