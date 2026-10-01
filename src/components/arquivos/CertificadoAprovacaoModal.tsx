import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { sendWhatsAppMessage } from "@/lib/evolution";

interface CertificadoAprovacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: {
    id: string;
    empresa: string;
    contato_nome?: string;
    contato_papel?: string;
    telefone: string;
    conversa_id?: string;
    mensagem_cliente?: string;
    contato_criado_em?: string;
  } | null;
  adminId: string;
  onSuccess?: () => void;
}

export function CertificadoAprovacaoModal({
  open,
  onOpenChange,
  pedido,
  adminId,
  onSuccess,
}: CertificadoAprovacaoModalProps) {
  const [confirmacaoNome, setConfirmacaoNome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recusando, setRecusando] = useState(false);

  if (!pedido) return null;

  const nomeEsperado = (pedido.empresa || "").trim();
  const nomeDigitado = confirmacaoNome.trim();
  const matches = nomeEsperado.toLowerCase() === nomeDigitado.toLowerCase();

  const handleAprovar = async () => {
    if (!matches) {
      toast.error("O nome digitado não confere exatamente com o nome da empresa.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Chamar decidir_envio_certificado no banco
      const { data, error } = await supabase.rpc("decidir_envio_certificado", {
        p_pedido: pedido.id,
        p_admin: adminId,
        p_aprovar: true,
        p_confirmacao_empresa: confirmacaoNome.trim(),
      });

      if (error) throw error;

      const token = data?.token;
      if (!token) throw new Error("Token de download não retornado");

      // 2. Montar texto conforme especificação
      const baseUrl = window.location.origin;
      const textoEnvio = `Segue o link para baixar o certificado digital da ${pedido.empresa}: ${baseUrl}/api/baixar/${token}\nEle vale por 24 horas e para um único download. A senha será informada por telefone.`;

      // 3. Enviar na conversa pelo WhatsApp
      const envio = await sendWhatsAppMessage(pedido.telefone, textoEnvio);
      if (!envio?.success) {
        throw new Error("Aprovado, mas o WhatsApp não enviou o link. Tente reenviar pelo chat antes de 24 h.");
      }

      // 4. Marcar como enviado
      await supabase.rpc("marcar_pedido_enviado", {
        p_pedido: pedido.id,
        p_usuario: adminId,
      });

      toast.success("Certificado digital aprovado e link temporário enviado!");
      setConfirmacaoNome("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Erro na aprovação do certificado:", err);
      toast.error(err.message || "Erro ao aprovar certificado digital");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecusar = async () => {
    setRecusando(true);
    try {
      const { error } = await supabase.rpc("decidir_envio_certificado", {
        p_pedido: pedido.id,
        p_admin: adminId,
        p_aprovar: false,
        p_motivo: "Recusado pelo administrador",
      });

      if (error) throw error;

      toast.info("Pedido de certificado digital recusado.");
      setConfirmacaoNome("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Erro ao recusar certificado:", err);
      toast.error(err.message || "Erro ao recusar envio");
    } finally {
      setRecusando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <ShieldAlert className="w-5 h-5" />
            <DialogTitle className="text-base font-bold text-foreground">
              Aprovação Crítica: Envio de Certificado Digital
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
            <p className="text-destructive font-semibold">
              Atenção: A aprovação gera um link temporário exclusivo de uso único (expira em 24h).
              A senha do certificado NUNCA deve ser enviada por chat ou link.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa:</span>
              <span className="font-bold text-foreground">{pedido.empresa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contato solicitante:</span>
              <span className="font-semibold">{pedido.contato_nome || "Contato"} {pedido.contato_papel ? `(${pedido.contato_papel})` : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">WhatsApp:</span>
              <span className="font-mono">{pedido.telefone}</span>
            </div>
            {pedido.mensagem_cliente && (
              <div className="pt-2 border-t border-border/40">
                <span className="text-muted-foreground block mb-1">Mensagem original:</span>
                <p className="italic bg-background p-2 rounded border text-foreground">
                  "{pedido.mensagem_cliente}"
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <Label htmlFor="confirm-empresa" className="text-xs font-bold text-foreground">
              Para confirmar, digite exatamente o nome da empresa:
            </Label>
            <Input
              id="confirm-empresa"
              placeholder={pedido.empresa}
              value={confirmacaoNome}
              onChange={(e) => setConfirmacaoNome(e.target.value)}
              className="h-10 text-xs"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">
              Digite exatamente: <span className="font-bold select-all text-foreground">{pedido.empresa}</span>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRecusar}
            disabled={submitting || recusando}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {recusando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Recusar Pedido"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleAprovar}
            disabled={submitting || recusando || !matches}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Aprovando e Gerando Link...
              </>
            ) : (
              "Aprovar e Enviar Link"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
