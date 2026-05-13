import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Merge, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useStore, Customer } from "@/lib/store";
import { normalizePhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function DuplicateCheckDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const store = useStore();

  const duplicates = useMemo(() => {
    const groups: Record<string, Customer[]> = {};
    
    store.customers.forEach(customer => {
      const phone = normalizePhone(customer.whatsapp || customer.phone || "");
      if (!phone) return;
      
      if (!groups[phone]) {
        groups[phone] = [];
      }
      groups[phone].push(customer);
    });

    return Object.entries(groups)
      .filter(([_, list]) => list.length > 1)
      .map(([phone, list]) => ({ phone, list }));
  }, [store.customers, open]);

  const handleMerge = async (phone: string, list: Customer[]) => {
    setLoading(true);
    try {
      // O primeiro será o "mestre" (preferencialmente um que tenha CNPJ)
      const master = list.find(c => c.cnpj && c.cnpj.trim().length > 0) || list[0];
      const others = list.filter(c => c.id !== master.id);

      // Excluir os outros no banco
      const { error } = await supabase
        .from("clientes")
        .delete()
        .in("id", others.map(o => o.id));

      if (error) throw error;

      // Atualizar store local
      others.forEach(o => store.deleteCustomer(o.id));
      
      toast.success(`Contatos duplicados para ${phone} mesclados com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao mesclar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      store.deleteCustomer(id);
      toast.success("Contato removido com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/50">
          <Copy className="h-4 w-4" />
          Verificar Duplicados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Análise de Contatos Duplicados
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Encontramos {duplicates.length} grupos de contatos com o mesmo número de telefone (considerando DDD e 9º dígito).
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4">
          {duplicates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="font-semibold">Nenhum duplicado encontrado!</p>
              <p className="text-sm text-muted-foreground">Sua base de dados está limpa.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {duplicates.map((group) => (
                <div key={group.phone} className="border rounded-xl overflow-hidden bg-muted/20">
                  <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-primary">{group.phone}</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleMerge(group.phone, group.list)}
                      disabled={loading}
                    >
                      <Merge className="h-3 w-3" />
                      Mesclar Todos
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.list.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.cnpj || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">{c.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(c.id)}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-50">
            <div className="bg-card p-4 rounded-xl shadow-xl flex items-center gap-3 border animate-in zoom-in-95">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Processando limpeza...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
