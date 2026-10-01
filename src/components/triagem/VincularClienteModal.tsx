import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Building2, Search, UserPlus, AlertCircle } from "lucide-react";
import { CustomerForm } from "@/components/CustomerForm";

interface VincularClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversaId: string;
  telefone?: string;
  nomeContatoPadrao?: string;
  onSuccess: () => void;
}

export function VincularClienteModal({
  open,
  onOpenChange,
  conversaId,
  telefone = "",
  nomeContatoPadrao = "",
  onSuccess,
}: VincularClienteModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [nomeContato, setNomeContato] = useState(nomeContatoPadrao);
  const [papel, setPapel] = useState("Responsável");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  useEffect(() => {
    if (open) {
      setNomeContato(nomeContatoPadrao);
      setSelectedCliente(null);
      setSearch("");
      setShowNewCustomer(false);
      loadInitialClientes();
    }
  }, [open, nomeContatoPadrao]);

  const loadInitialClientes = async () => {
    if (!user?.tenantId) return;
    try {
      setSearching(true);
      const { data } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj, whatsapp")
        .eq("tenant_id", user.tenantId)
        .order("nome_fantasia", { ascending: true })
        .limit(10);
      setClientes(data || []);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (term: string) => {
    setSearch(term);
    if (!user?.tenantId) return;
    const clean = term.trim();
    if (!clean) {
      loadInitialClientes();
      return;
    }

    try {
      setSearching(true);
      const cleanDigits = clean.replace(/\D/g, "");
      let query = supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj, whatsapp")
        .eq("tenant_id", user.tenantId);

      if (cleanDigits.length >= 3) {
        query = query.or(`nome_fantasia.ilike.%${clean}%,razao_social.ilike.%${clean}%,cnpj.ilike.%${cleanDigits}%`);
      } else {
        query = query.or(`nome_fantasia.ilike.%${clean}%,razao_social.ilike.%${clean}%`);
      }

      const { data } = await query.limit(10);
      setClientes(data || []);
    } finally {
      setSearching(false);
    }
  };

  const handleVincular = async () => {
    if (!selectedCliente) {
      toast.error("Selecione um cliente para vincular.");
      return;
    }
    if (!user?.id) return;

    try {
      setLoading(true);
      const { error } = await supabase.rpc("vincular_conversa_cliente", {
        p_conversa: conversaId,
        p_cliente: selectedCliente.id,
        p_usuario: user.id,
        p_nome_contato: nomeContato || null,
        p_papel: papel || null,
      });

      if (error) throw error;

      toast.success(`Conversa vinculada a ${selectedCliente.nome_fantasia || selectedCliente.razao_social}!`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao vincular conversa:", err);
      toast.error(err.message || "Erro ao vincular conversa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-5 w-5 text-primary" />
            Vincular conversa a cliente
          </DialogTitle>
          <DialogDescription>
            Ao vincular, esta conversa irá para o funil de Atendimento e este telefone ficará salvo como contato da empresa.
          </DialogDescription>
        </DialogHeader>

        {showNewCustomer ? (
          <div className="py-2">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <span className="text-sm font-bold">Novo cadastro de cliente</span>
              <Button variant="ghost" size="sm" onClick={() => setShowNewCustomer(false)}>
                Voltar à busca
              </Button>
            </div>
            <CustomerForm
              initialData={{
                name: nomeContatoPadrao || "",
                whatsapp: telefone || "",
                phone: telefone || "",
                responsibleName: nomeContatoPadrao || "",
              }}
              onSuccess={(novoCliente) => {
                setShowNewCustomer(false);
                setSelectedCliente(novoCliente);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar empresa por nome ou CNPJ</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite nome fantasia, razão social ou CNPJ..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5 max-h-[200px] overflow-y-auto rounded-xl border border-border p-1 scrollbar-thin">
              {searching ? (
                <p className="text-center text-xs text-muted-foreground py-6">Buscando empresas...</p>
              ) : clientes.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Nenhuma empresa encontrada.
                </div>
              ) : (
                clientes.map((c) => {
                  const isSelected = selectedCliente?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCliente(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.nome_fantasia || c.razao_social}</p>
                        <p className={`text-[11px] truncate ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {c.cnpj ? `CNPJ: ${c.cnpj}` : c.razao_social}
                        </p>
                      </div>
                      {isSelected && <span className="text-xs shrink-0 ml-2">✓ Selecionado</span>}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Não encontrou o cliente?</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setShowNewCustomer(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Cadastrar novo cliente
              </Button>
            </div>

            {selectedCliente && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Nome deste contato</Label>
                    <Input
                      value={nomeContato}
                      onChange={(e) => setNomeContato(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Papel/Cargo na empresa</Label>
                    <Select value={papel} onValueChange={setPapel}>
                      <SelectTrigger className="h-9 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Responsável">Responsável</SelectItem>
                        <SelectItem value="Sócio">Sócio</SelectItem>
                        <SelectItem value="Financeiro">Financeiro</SelectItem>
                        <SelectItem value="RH">RH</SelectItem>
                        <SelectItem value="Fiscal">Fiscal</SelectItem>
                        <SelectItem value="Colaborador">Colaborador</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {!showNewCustomer && (
            <Button
              onClick={handleVincular}
              disabled={!selectedCliente || loading}
              className="bg-primary text-primary-foreground font-bold"
            >
              {loading ? "Vinculando..." : "Confirmar vínculo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
