import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface EnviarPreVendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversaId: string;
  nomeContatoPadrao?: string;
  onSuccess: () => void;
}

export function EnviarPreVendaModal({
  open,
  onOpenChange,
  conversaId,
  nomeContatoPadrao = "",
  onSuccess,
}: EnviarPreVendaModalProps) {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState("");
  const [origem, setOrigem] = useState("whatsapp");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnviar = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { error } = await supabase.rpc("enviar_para_pre_venda", {
        p_conversa: conversaId,
        p_usuario: user.id,
        p_empresa: empresa.trim() || null,
        p_origem: origem || "whatsapp",
        p_observacao: observacao.trim() || null,
      });

      if (error) throw error;

      toast.success("Conversa encaminhada para a Pré-venda!");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao encaminhar para pré-venda:", err);
      toast.error(err.message || "Erro ao encaminhar para pré-venda");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Possível cliente (Pré-venda)
          </DialogTitle>
          <DialogDescription>
            A conversa será movida para a Pré-venda e ficará visível apenas para os administradores e supervisores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Nome da empresa (opcional)</Label>
            <Input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex: Padaria Estrela LTDA"
              className="h-10 rounded-xl text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Origem do contato</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp direto</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="site">Site institucional</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="empreenda_hub">Empreenda Hub</SelectItem>
                <SelectItem value="evento">Evento presencial</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Observação inicial (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="O que o cliente precisa? Ex: quer trocar de contador, MEI desenquadrado..."
              className="resize-none rounded-xl text-sm min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={loading} className="bg-primary text-primary-foreground font-bold">
            {loading ? "Encaminhando..." : "Enviar para Pré-venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
