import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface PedirAcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  clienteId: string;
  clienteNome: string;
  area: "rh" | "financeiro" | "certificado";
  conversaId?: string;
  onSuccess?: () => void;
}

const AREA_LABELS: Record<string, string> = {
  rh: "Recursos Humanos (RH)",
  financeiro: "Financeiro",
  certificado: "Certificado Digital",
};

export function PedirAcessoDialog({
  open,
  onOpenChange,
  userId,
  clienteId,
  clienteNome,
  area,
  conversaId,
  onSuccess,
}: PedirAcessoDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) {
      toast.error("O motivo deve ter pelo menos 5 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("solicitar_acesso", {
        p_usuario: userId,
        p_cliente: clienteId,
        p_area: area,
        p_motivo: motivo.trim(),
        p_conversa: conversaId || null,
      });

      if (error) throw error;

      toast.success("Solicitação enviada com sucesso! Aguarde a aprovação de um admin/supervisor.");
      setMotivo("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Erro ao solicitar acesso:", err);
      toast.error(err.message || "Erro ao solicitar acesso");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <Lock className="w-5 h-5" />
            <DialogTitle className="text-base font-bold text-foreground">Solicitar Acesso à Área Restrita</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-semibold">{clienteNome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área:</span>
              <span className="font-semibold text-primary">{AREA_LABELS[area] || area}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-xs font-semibold">
              Motivo do pedido (obrigatório)
            </Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Enviar folha de pagamento atual solicitada pelo cliente via WhatsApp"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[80px] text-xs resize-none"
              disabled={submitting}
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              Mínimo de 5 caracteres. A aprovação é válida por tempo limitado para este cliente.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting || motivo.trim().length < 5}>
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Pedido"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
