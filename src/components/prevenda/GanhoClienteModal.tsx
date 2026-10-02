import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/CustomerForm";
import { Trophy } from "lucide-react";

interface GanhoClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidade: any;
  onSuccess: (clienteId: string) => void;
}

export function GanhoClienteModal({
  open,
  onOpenChange,
  oportunidade,
  onSuccess,
}: GanhoClienteModalProps) {
  if (!oportunidade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 scrollbar-thin">
        <DialogHeader className="mb-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-success">
            <Trophy className="h-6 w-6 text-amber-500" />
            Oportunidade Ganha
          </DialogTitle>
          <DialogDescription>
            Cadastre o cliente para finalizar a oportunidade. A conversa será vinculada automaticamente e enviada para o funil de Atendimento.
          </DialogDescription>
        </DialogHeader>

        <CustomerForm
          initialData={{
            name: oportunidade.empresa_nome || oportunidade.nome_contato,
            razaoSocial: oportunidade.empresa_nome || "",
            responsibleName: oportunidade.nome_contato,
            whatsapp: oportunidade.telefone || "",
            phone: oportunidade.telefone || "",
            cnpj: oportunidade.cnpj || "",
            monthlyValue: oportunidade.valor_mensal_estimado || 0,
            origin: oportunidade.origem || "whatsapp",
            observations: oportunidade.observacoes || "",
          }}
          onSuccess={(novoCliente) => {
            onOpenChange(false);
            onSuccess(novoCliente.id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
