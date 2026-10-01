import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";

interface MotivoPerdaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => void;
  loading?: boolean;
}

const MOTIVOS_PERDA = [
  { id: "preco", label: "Preço / Honorários altos" },
  { id: "ficou_com_atual", label: "Decidiu ficar com o contador atual" },
  { id: "sem_resposta", label: "Sem resposta / Parou de responder" },
  { id: "nao_era_o_momento", label: "Não era o momento ideal" },
  { id: "servico_nao_atendido", label: "Serviço que o escritório não atende" },
  { id: "outro", label: "Outro motivo" },
];

export function MotivoPerdaModal({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: MotivoPerdaModalProps) {
  const [motivo, setMotivo] = useState("preco");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
            <AlertCircle className="h-5 w-5" />
            Motivo da Perda do Lead
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo para arquivar a oportunidade e alimentar as métricas do funil.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <RadioGroup value={motivo} onValueChange={setMotivo} className="space-y-2">
            {MOTIVOS_PERDA.map((m) => (
              <label
                key={m.id}
                htmlFor={`perda-${m.id}`}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  motivo === m.id
                    ? "border-destructive/60 bg-destructive/5 text-foreground font-semibold"
                    : "border-border hover:bg-muted/50 text-foreground"
                }`}
              >
                <span className="text-sm">{m.label}</span>
                <RadioGroupItem value={m.id} id={`perda-${m.id}`} />
              </label>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivo)}
            disabled={loading}
            className="font-bold"
          >
            {loading ? "Registrando..." : "Confirmar perda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
