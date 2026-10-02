import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, FolderTree, HardDrive, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

interface DriveStatus {
  conectado: boolean;
  email?: string | null;
  conectado_em?: string;
  ultimo_erro?: string | null;
  documentos_no_drive?: number;
}

const MOTIVOS: Record<string, string> = {
  sessao: "A autorização demorou demais. Tente conectar de novo.",
  negado: "A permissão foi negada no Google.",
  permissao: "É preciso marcar a permissão de arquivos do Drive na tela do Google.",
  token: "O Google não devolveu a autorização completa. Tente de novo.",
  falha: "Não foi possível concluir a conexão. Tente de novo.",
};

/**
 * Conexão do Google Drive do escritório. O Conta+ pede só a permissão "drive.file":
 * enxerga apenas as pastas e os arquivos que ele mesmo criar.
 */
export default function GoogleDriveCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const admin = user?.role === "admin";

  const carregar = useCallback(async () => {
    if (!user?.tenantId) return;
    const { data, error } = await supabase.rpc("google_drive_status", { p_tenant: user.tenantId });
    // Antes da migration 016 a função não existe: mostra como não conectado.
    setStatus(error ? { conectado: false } : (data as DriveStatus));
  }, [user?.tenantId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Volta do Google: /settings?drive=ok | drive=erro&motivo=...
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const retorno = qs.get("drive");
    if (!retorno) return;
    if (retorno === "ok") toast.success("Google Drive conectado. As pastas do Conta+ foram criadas.");
    else toast.error(MOTIVOS[qs.get("motivo") || ""] || "Não foi possível conectar o Google Drive.");
    qs.delete("drive");
    qs.delete("motivo");
    const resto = qs.toString();
    window.history.replaceState({}, "", window.location.pathname + (resto ? `?${resto}` : ""));
  }, []);

  const conectar = () => {
    if (!user?.tenantId || !user?.id) return;
    setOcupado(true);
    window.location.href = `/api/google?action=iniciar&tenant=${user.tenantId}&usuario=${user.id}`;
  };

  const desconectar = async () => {
    if (!user?.tenantId || !user?.id) return;
    const ok = window.confirm(
      "Desconectar o Google Drive?\n\n" +
      "Os arquivos continuam no Drive do escritório, mas o Conta+ deixa de abrir e enviar " +
      "esses documentos até você conectar a mesma conta de novo."
    );
    if (!ok) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/google?action=desconectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: user.tenantId, usuario: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Não foi possível desconectar");
      toast.success("Google Drive desconectado.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desconectar");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          Google Drive do escritório
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
          </div>
        ) : status.conectado ? (
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-success/30 bg-success/5">
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold">Conectado{status.email ? ` como ${status.email}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {status.documentos_no_drive ?? 0} documento(s) guardado(s) no Drive pelo Conta+.
                </p>
              </div>
            </div>
            {status.ultimo_erro && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{status.ultimo_erro}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Conecte a conta Google do escritório para guardar os documentos dos clientes no Drive de vocês.
            O Conta+ só enxerga o que ele mesmo criar.
          </p>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">
          <FolderTree className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-mono">Conta+ / Clientes / CNPJ - Nome / Área / AAAA-MM</p>
            <p className="mt-1">
              A pasta do cliente nasce no cadastro; a da área e a do mês, no primeiro documento.
              O certificado digital não vai para o Drive: fica no cofre do sistema.
            </p>
          </div>
        </div>

        {admin ? (
          <div className="flex flex-wrap gap-3">
            {status?.conectado ? (
              <>
                <Button variant="outline" size="sm" onClick={conectar} disabled={ocupado}>
                  Trocar de conta
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={desconectar} disabled={ocupado}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button onClick={conectar} disabled={ocupado || status === null}>
                {ocupado ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HardDrive className="w-4 h-4 mr-2" />}
                Conectar Google Drive
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Só o administrador pode conectar ou desconectar o Drive.</p>
        )}
      </CardContent>
    </Card>
  );
}
