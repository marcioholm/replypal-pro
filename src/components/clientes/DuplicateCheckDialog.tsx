import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Copy, Trash2, Merge, CheckCircle2, AlertTriangle, 
  Loader2, Edit2, Check, X, ShieldCheck
} from "lucide-react";
import { useStore, Customer } from "@/lib/store";
import { normalizePhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function DuplicateCheckDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const store = useStore();

  const analysis = useMemo(() => {
    const duplicatesGroups: Record<string, Customer[]> = {};
    const shortNumbers: Customer[] = []; // Faltando 9º dígito (10 ou 12 dígitos)
    const longNumbers: Customer[] = [];  // Mais de 13 dígitos

    store.customers.forEach(customer => {
      const rawPhone = customer.whatsapp || customer.phone || "";
      const cleaned = rawPhone.replace(/\D/g, "");
      const normalized = normalizePhone(rawPhone);
      
      if (!cleaned) return;

      // Verificar Duplicados
      if (!duplicatesGroups[normalized]) {
        duplicatesGroups[normalized] = [];
      }
      duplicatesGroups[normalized].push(customer);

      // Verificar Curto (Sem 55: 10 dígitos / Com 55: 12 dígitos)
      if (cleaned.length === 10 || (cleaned.startsWith("55") && cleaned.length === 12)) {
        shortNumbers.push(customer);
      }

      // Verificar Longo (> 13 dígitos)
      if (cleaned.length > 13) {
        longNumbers.push(customer);
      }
    });

    const duplicates = Object.entries(duplicatesGroups)
      .filter(([_, list]) => list.length > 1)
      .map(([phone, list]) => ({ phone, list }));

    return { duplicates, shortNumbers, longNumbers };
  }, [store.customers, open]);

  const handleMerge = async (phone: string, list: Customer[]) => {
    setLoading(true);
    try {
      const master = list.find(c => c.cnpj && c.cnpj.trim().length > 0) || 
                     list.find(c => c.name && c.name !== c.whatsapp) || 
                     list[0];
      
      const others = list.filter(c => c.id !== master.id);

      const { error } = await supabase
        .from("clientes")
        .delete()
        .in("id", others.map(o => o.id));

      if (error) throw error;

      others.forEach(o => store.deleteCustomer(o.id));
      toast.success(`Contatos para ${phone} mesclados!`);
    } catch (err: any) {
      toast.error("Erro ao mesclar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      store.deleteCustomer(id);
      toast.success("Contato removido!");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditValue(customer.whatsapp || customer.phone || "");
  };

  const saveEdit = async (id: string) => {
    setLoading(true);
    try {
      const cleanPhone = editValue.replace(/\D/g, "");
      const { error } = await supabase
        .from("clientes")
        .update({ whatsapp: cleanPhone, telefone: cleanPhone })
        .eq("id", id);

      if (error) throw error;

      store.updateCustomer(id, { whatsapp: cleanPhone, phone: cleanPhone });
      setEditingId(null);
      toast.success("Número atualizado!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
          <ShieldCheck className="h-4 w-4" />
          Higienização de Dados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Higienização da Base de Contatos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Analise e corrija inconsistências nos seus contatos para garantir a qualidade das automações.
          </p>
        </DialogHeader>

        <Tabs defaultValue="duplicates" className="flex-1 overflow-hidden flex flex-col mt-4">
          <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="duplicates" className="rounded-lg font-semibold">
              Duplicados ({analysis.duplicates.length})
            </TabsTrigger>
            <TabsTrigger value="short" className="rounded-lg font-semibold">
              Sem 9º Dígito ({analysis.shortNumbers.length})
            </TabsTrigger>
            <TabsTrigger value="long" className="rounded-lg font-semibold">
              Números Longos ({analysis.longNumbers.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-6 px-1">
            <TabsContent value="duplicates" className="m-0 space-y-6">
              {analysis.duplicates.length === 0 ? (
                <EmptyState message="Nenhum duplicado encontrado!" />
              ) : (
                analysis.duplicates.map((group) => (
                  <div key={group.phone} className="border rounded-2xl overflow-hidden bg-muted/20">
                    <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">{group.phone}</span>
                        <Badge variant="secondary" className="text-[10px]">{group.list.length} ocorrências</Badge>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => handleMerge(group.phone, group.list)} disabled={loading}>
                        <Merge className="h-3.5 w-3.5" />
                        Mesclar Todos
                      </Button>
                    </div>
                    <AnomaliesTable 
                      list={group.list} 
                      onDelete={handleDelete} 
                      onEdit={startEdit} 
                      editingId={editingId} 
                      editValue={editValue} 
                      setEditValue={setEditValue} 
                      onSave={saveEdit} 
                      onCancel={() => setEditingId(null)} 
                      loading={loading}
                    />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="short" className="m-0">
              {analysis.shortNumbers.length === 0 ? (
                <EmptyState message="Todos os números possuem o 9º dígito!" />
              ) : (
                <div className="border rounded-2xl overflow-hidden">
                  <AnomaliesTable 
                    list={analysis.shortNumbers} 
                    onDelete={handleDelete} 
                    onEdit={startEdit} 
                    editingId={editingId} 
                    editValue={editValue} 
                    setEditValue={setEditValue} 
                    onSave={saveEdit} 
                    onCancel={() => setEditingId(null)} 
                    loading={loading}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="long" className="m-0">
              {analysis.longNumbers.length === 0 ? (
                <EmptyState message="Nenhum número com dígitos excedentes!" />
              ) : (
                <div className="border rounded-2xl overflow-hidden">
                  <AnomaliesTable 
                    list={analysis.longNumbers} 
                    onDelete={handleDelete} 
                    onEdit={startEdit} 
                    editingId={editingId} 
                    editValue={editValue} 
                    setEditValue={setEditValue} 
                    onSave={saveEdit} 
                    onCancel={() => setEditingId(null)} 
                    loading={loading}
                  />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {loading && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 border animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <span className="text-sm font-bold text-primary uppercase tracking-widest">Processando...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnomaliesTable({ list, onDelete, onEdit, editingId, editValue, setEditValue, onSave, onCancel, loading }: any) {
  return (
    <Table>
      <TableHeader className="bg-muted/30">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[250px]">Nome</TableHead>
          <TableHead>WhatsApp / Telefone</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((c: Customer) => (
          <TableRow key={c.id} className="group hover:bg-muted/10 transition-colors">
            <TableCell className="font-semibold text-sm">{c.name}</TableCell>
            <TableCell>
              {editingId === c.id ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                  <Input 
                    value={editValue} 
                    onChange={e => setEditValue(e.target.value)} 
                    className="h-8 text-sm font-mono rounded-lg w-48"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => onSave(c.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={onCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <span className="font-mono text-sm">{c.whatsapp || c.phone}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(c)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground font-mono">{c.cnpj || "-"}</TableCell>
            <TableCell className="text-right">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl"
                onClick={() => onDelete(c.id)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4 dark:bg-green-950/20">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
      </div>
      <p className="font-bold text-lg">{message}</p>
      <p className="text-sm text-muted-foreground mt-1">Sua base de dados está em conformidade.</p>
    </div>
  );
}
