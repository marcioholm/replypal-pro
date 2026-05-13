import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

interface SimpleContactDialogProps {
  initialPhone?: string;
  initialName?: string;
  onSuccess?: (contact: any) => void;
  trigger?: React.ReactNode;
}

export function SimpleContactDialog({ initialPhone, initialName, onSuccess, trigger }: SimpleContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const store = useStore();

  const [formData, setFormData] = useState({
    name: initialName || "",
    phone: initialPhone || "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Nome e Telefone são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = formData.phone.replace(/\D/g, "");
      
      // Upsert para evitar duplicidade pelo whatsapp + tenant_id
      const { data, error } = await supabase
        .from("clientes")
        .upsert({
          tenant_id: user?.tenantId,
          nome_fantasia: formData.name,
          whatsapp: cleanPhone,
          telefone: cleanPhone,
          email: formData.email,
          status: "Ativo",
          prioridade: "Média",
          service_level: "Padrão",
          preferred_channel: "WhatsApp",
          origin: "Manual"
        }, { onConflict: "whatsapp,tenant_id" })
        .select()
        .single();

      if (error) throw error;

      store.addDbCustomer({
        id: data.id,
        name: data.nome_fantasia,
        razaoSocial: data.razao_social || "",
        cnpj: data.cnpj || "",
        responsibleName: data.responsavel || "",
        whatsapp: data.whatsapp || "",
        phone: data.telefone || "",
        email: data.email || "",
        city: data.cidade || "",
        state: data.estado || "",
        regime: data.regime_tributario as any,
        status: data.status as any,
        priority: (data.prioridade || "Média") as any,
        tenantId: data.tenant_id,
        createdAt: new Date(data.created_at)
      });

      toast.success("Contato salvo com sucesso!");
      setOpen(false);
      if (onSuccess) onSuccess(data);
    } catch (err: any) {
      console.error("Erro ao salvar contato:", err);
      toast.error("Erro ao salvar contato: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Contato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastrar Novo Contato
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              placeholder="Ex: João Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp / Telefone</Label>
            <Input
              id="phone"
              placeholder="Ex: 5543999999999"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail (Opcional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="contato@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Salvar Contato
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
