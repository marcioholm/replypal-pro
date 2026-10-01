import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Archive, AlertCircle } from "lucide-react";

interface ArquivarConversaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversaId: string;
  onSuccess: () => void;
  onVincularClick?: () => void;
}

const MOTIVOS = [
  { id: "funcionario_de_cliente", label: "Funcionário de cliente", dica: "Dica: quase sempre é melhor 'Vincular a cliente' para manter o histórico junto à empresa." },
  { id: "fornecedor", label: "Fornecedor", dica: "" },
  { id: "parceiro", label: "Parceiro comercial", dica: "" },
  { id: "pessoal", label: "Contato pessoal", dica: "" },
  { id: "spam", label: "Spam ou cobrança indevida", dica: "" },
  { id: "outro", label: "Outro motivo", dica: "" },
];

export function ArquivarConversaModal({
  open,
  onOpenChange,
  conversaId,
  onSuccess,
  onVincularClick,
}: ArquivarConversaModalProps) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("fornecedor");
  const [loading, setLoading] = useState(false);

  const handleArquivar = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { error } = await supabase.rpc("arquivar_conversa", {
        p_conversa: conversaId,
        p_usuario: user.id,
        p_motivo: motivo,
      });

      if (error) throw error;

      toast.success("Conversa arquivada.");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao arquivar conversa:", err);
      toast.error(err.message || "Erro ao arquivar conversa");
    } finally {
      setLoading(false);
    }
  };

  const motivoAtual = MOTIVOS.find((m) => m.id === motivo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Não é cliente (Arquivar)
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo pelo qual este contato não deve ser atendido nem cadastrado como oportunidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={motivo} onValueChange={setMotivo} className="space-y-2">
            {MOTIVOS.map((m) => (
              <label
                key={m.id}
                htmlFor={m.id}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  motivo === m.id
                    ? "border-primary bg-primary/5 text-foreground font-semibold"
                    : "border-border hover:bg-muted/50 text-foreground"
                }`}
              >
                <span className="text-sm">{m.label}</span>
                <RadioGroupItem value={m.id} id={m.id} />
              </label>
            ))}
          </RadioGroup>

          {motivoAtual?.dica && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p>{motivoAtual.dica}</p>
                {onVincularClick && (
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-xs font-bold text-primary underline"
                    onClick={() => {
                      onOpenChange(false);
                      onVincularClick();
                    }}
                  >
                    Mudar para "Vincular a cliente"
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleArquivar} disabled={loading} variant="destructive" className="font-bold">
            {loading ? "Arquivando..." : "Confirmar arquivamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
