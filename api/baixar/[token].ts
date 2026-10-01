import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Rota para baixar documento com link temporário de uso único (certificado digital).
 * Chama `usar_link_download(token)` com a chave de serviço.
 * Se OK, redireciona para o arquivo (gerando URL assinada se for storage privado).
 * Se expirado ou já usado, exibe página de aviso amigável.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return renderErrorPage(res, "Link inválido ou não fornecido.");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return renderErrorPage(res, "Configuração do servidor indisponível.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Chamar RPC do banco com service_role
    const { data, error } = await supabase.rpc("usar_link_download", {
      p_token: token.trim(),
    });

    if (error || !data || !data.ok) {
      return renderErrorPage(
        res,
        "Este link expirou ou já foi utilizado para download anteriormente. Por motivos de segurança, cada link é de uso único e vale por 24 horas. Fale com a equipe do escritório."
      );
    }

    let downloadUrl = data.url;

    // Se o arquivo estiver em um bucket privado do Supabase Storage, gerar URL assinada
    if (downloadUrl && downloadUrl.includes("/storage/v1/object/")) {
      try {
        const parts = downloadUrl.split("/storage/v1/object/");
        if (parts[1]) {
          const pathParts = parts[1].replace(/^(public|authenticated|sign)\//, "").split("/");
          const bucket = pathParts[0];
          const filePath = pathParts.slice(1).join("/");
          const { data: signedData, error: signErr } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(filePath, 300); // 5 minutos de validade

          if (!signErr && signedData?.signedUrl) {
            downloadUrl = signedData.signedUrl;
          }
        }
      } catch (e) {
        console.error("Erro ao gerar URL assinada para download:", e);
      }
    }

    // Redireciona para o arquivo
    res.writeHead(302, { Location: downloadUrl });
    return res.end();
  } catch (err: any) {
    console.error("Erro no endpoint /api/baixar/:token:", err);
    return renderErrorPage(res, "Ocorreu um erro interno ao processar seu download. Tente novamente ou contate o escritório.");
  }
}

function renderErrorPage(res: VercelResponse, mensagem: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(403).send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conta+ · Download de Documento</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .icon {
      width: 56px;
      height: 56px;
      background: #fef2f2;
      color: #ef4444;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-size: 24px;
      font-weight: bold;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #1e293b;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
      margin: 0;
    }
    .brand {
      margin-top: 32px;
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">!</div>
    <h1>Link indisponível</h1>
    <p>${mensagem}</p>
    <div class="brand">Conta+ Gestão Contábil</div>
  </div>
</body>
</html>
  `);
}
