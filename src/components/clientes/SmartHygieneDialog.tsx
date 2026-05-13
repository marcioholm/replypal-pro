import { useState, useMemo, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, 
  Search, Filter, Trash2, Merge, Edit2, Check, X, 
  Loader2, ArrowRight, Download, History, Info,
  ChevronDown, MoreHorizontal, MousePointer2,
  ChevronLeft, ChevronRight, Zap
} from "lucide-react";
import { useStore, Customer } from "@/lib/store";
import { analyzeContact, AuditResult, Severity } from "@/lib/contactAudit";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export function SmartHygieneDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"apply" | "delete" | "ignore" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const store = useStore();

  const auditData = useMemo(() => {
    const results: (Customer & { audit: AuditResult })[] = store.customers.map(c => ({
      ...c,
      audit: analyzeContact(c)
    }));

    // Find duplicates separately
    const groups: Record<string, string[]> = {};
    results.forEach(r => {
      if (!groups[r.audit.normalizedPhone]) groups[r.audit.normalizedPhone] = [];
      groups[r.audit.normalizedPhone].push(r.id);
    });

    results.forEach(r => {
      if (groups[r.audit.normalizedPhone].length > 1) {
        r.audit.severity = r.audit.severity === "CRITICAL" ? "CRITICAL" : "DUPLICATE";
        if (!r.audit.issues.some(i => i.type === "duplicate")) {
          r.audit.issues.push({ type: "duplicate", message: "Contato duplicado", severity: "DUPLICATE" });
        }
      }
    });

    return results;
  }, [store.customers, open]);

  const metrics = useMemo(() => {
    const total = auditData.length;
    const valid = auditData.filter(d => d.audit.severity === "OK").length;
    const critical = auditData.filter(d => d.audit.severity === "CRITICAL").length;
    const attention = auditData.filter(d => d.audit.severity === "ATTENTION").length;
    const duplicates = auditData.filter(d => d.audit.severity === "DUPLICATE").length;
    const withSuggestions = auditData.filter(d => d.audit.suggestion).length;
    const qualityScore = total > 0 ? Math.round((valid / total) * 100) : 100;

    return { total, valid, critical, attention, duplicates, withSuggestions, qualityScore };
  }, [auditData]);

  const filteredData = useMemo(() => {
    let data = auditData;

    if (activeTab === "duplicates") data = data.filter(d => d.audit.severity === "DUPLICATE");
    else if (activeTab === "critical") data = data.filter(d => d.audit.severity === "CRITICAL");
    else if (activeTab === "attention") data = data.filter(d => d.audit.severity === "ATTENTION");
    else if (activeTab === "suggestions") data = data.filter(d => d.audit.suggestion);

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(d => 
        d.name.toLowerCase().includes(s) || 
        d.audit.normalizedPhone.includes(s)
      );
    }

    return data;
  }, [auditData, activeTab, search]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    return filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search]);

  const handleApplySuggestion = async (id: string, suggestion: string) => {
    setLoading(true);
    try {
      const cleanPhone = suggestion.replace(/\D/g, "");
      const { error } = await supabase
        .from("clientes")
        .update({ whatsapp: cleanPhone, telefone: cleanPhone })
        .eq("id", id);

      if (error) throw error;
      store.updateCustomer(id, { whatsapp: cleanPhone, phone: cleanPhone });
      toast.success("Sugestão aplicada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao aplicar sugestão: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction) return;
    setLoading(true);
    try {
      if (bulkAction === "delete") {
        const { error } = await supabase.from("clientes").delete().in("id", selectedIds);
        if (error) throw error;
        selectedIds.forEach(id => store.deleteCustomer(id));
        toast.success(`${selectedIds.length} contatos removidos.`);
      } else if (bulkAction === "apply") {
        let count = 0;
        for (const id of selectedIds) {
          const item = auditData.find(d => d.id === id);
          if (item?.audit.suggestion) {
            const cleanPhone = item.audit.suggestion.replace(/\D/g, "");
            await supabase.from("clientes").update({ whatsapp: cleanPhone, telefone: cleanPhone }).eq("id", id);
            store.updateCustomer(id, { whatsapp: cleanPhone, phone: cleanPhone });
            count++;
          }
        }
        toast.success(`${count} sugestões aplicadas.`);
      }
      setSelectedIds([]);
      setIsBulkConfirmOpen(false);
    } catch (err: any) {
      toast.error("Erro na ação em massa: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (phone: string, list: (Customer & { audit: AuditResult })[]) => {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl px-4 font-bold shadow-sm">
          <ShieldCheck className="h-4 w-4" />
          Auditoria de Contatos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-[32px] border-none shadow-2xl bg-background/95 backdrop-blur-xl">
        {/* Header Premium */}
        <div className="p-8 border-b bg-muted/20">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <DialogTitle className="text-3xl font-black tracking-tight text-foreground/90">
                  Higienização Inteligente
                </DialogTitle>
              </div>
              <p className="text-muted-foreground font-medium pl-11">
                Auditoria avançada da base de dados com inteligência artificial para correção de números.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Qualidade da Base</p>
                <div className="flex items-center gap-3">
                  <Progress value={metrics.qualityScore} className="w-32 h-2.5 bg-muted" />
                  <span className={cn(
                    "text-xl font-black",
                    metrics.qualityScore > 80 ? "text-green-500" : metrics.qualityScore > 50 ? "text-amber-500" : "text-destructive"
                  )}>
                    {metrics.qualityScore}%
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12 border bg-background" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Cards de Métricas Estilo HubSpot */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total" value={metrics.total} icon={MousePointer2} color="primary" />
            <MetricCard label="Válidos" value={metrics.valid} icon={CheckCircle2} color="green" />
            <MetricCard label="Críticos" value={metrics.critical} icon={AlertCircle} color="red" />
            <MetricCard label="Atenção" value={metrics.attention} icon={AlertTriangle} color="amber" />
            <MetricCard label="Duplicados" value={metrics.duplicates} icon={Merge} color="purple" />
            <MetricCard label="Sugestões" value={metrics.withSuggestions} icon={ZapIcon} color="blue" />
          </div>
        </div>

        {/* Toolbar e Filtros */}
        <div className="px-8 py-4 border-b bg-card flex flex-col md:flex-row items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
              <TabsTrigger value="all" className="rounded-lg px-6 font-bold text-xs uppercase tracking-wider">Todos</TabsTrigger>
              <TabsTrigger value="critical" className="rounded-lg px-6 font-bold text-xs uppercase tracking-wider">Críticos</TabsTrigger>
              <TabsTrigger value="attention" className="rounded-lg px-6 font-bold text-xs uppercase tracking-wider">Atenção</TabsTrigger>
              <TabsTrigger value="duplicates" className="rounded-lg px-6 font-bold text-xs uppercase tracking-wider">Duplicados</TabsTrigger>
              <TabsTrigger value="suggestions" className="rounded-lg px-6 font-bold text-xs uppercase tracking-wider">Sugestões</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome ou telefone..." 
                className="pl-10 h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-12 w-12 rounded-xl p-0">
              <Download className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Bulk Action Bar (Floating if selection exists) */}
        {selectedIds.length > 0 && (
          <div className="bg-primary px-8 py-4 flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-3 text-primary-foreground">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold">{selectedIds.length} selecionados</span>
              </div>
              {selectedIds.length < filteredData.length && (
                <button 
                  onClick={() => setSelectedIds(filteredData.map(d => d.id))}
                  className="text-[10px] text-white/80 hover:text-white underline font-bold uppercase tracking-widest text-left"
                >
                  Selecionar todos os {filteredData.length} itens desta aba
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="font-bold h-10 px-6 rounded-xl shadow-lg" onClick={() => { setBulkAction("apply"); setIsBulkConfirmOpen(true); }}>
                <Zap className="w-4 h-4 mr-2" />
                Aplicar Sugestões
              </Button>
              <Button variant="secondary" size="sm" className="font-bold h-10 px-6 rounded-xl bg-red-100 text-red-700 hover:bg-red-200" onClick={() => { setBulkAction("delete"); setIsBulkConfirmOpen(true); }}>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
              <Button variant="ghost" size="sm" className="font-bold h-10 px-4 text-white hover:bg-white/10" onClick={() => setSelectedIds([])}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Tabela de Auditoria */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === "duplicates" ? (
            <div className="space-y-6">
              {Object.entries(
                filteredData.reduce((acc, curr) => {
                  const phone = curr.audit.normalizedPhone;
                  if (!acc[phone]) acc[phone] = [];
                  acc[phone].push(curr);
                  return acc;
                }, {} as Record<string, (Customer & { audit: AuditResult })[]>)
              ).map(([phone, list]) => (
                <div key={phone} className="border rounded-3xl overflow-hidden bg-card shadow-sm border-purple-100">
                  <div className="bg-purple-50/50 px-6 py-4 border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-xl">
                        <Merge className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono font-black text-sm text-purple-900 tracking-tight">{phone}</span>
                        <span className="text-[10px] font-bold text-purple-600/70 uppercase tracking-widest">{list.length} registros duplicados</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-10 px-4 gap-2 rounded-xl border-purple-200 bg-white text-purple-700 hover:bg-purple-50 font-bold shadow-sm"
                      onClick={() => handleMerge(phone, list)}
                      disabled={loading}
                    >
                      <Merge className="h-4 w-4" />
                      Mesclar Grupo
                    </Button>
                  </div>
                  <AnomaliesTable 
                    list={list} 
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    onDelete={handleDelete}
                    onEdit={(c: any) => { setEditingId(c.id); setEditValue(c.whatsapp || c.phone || ""); }}
                    onApplySuggestion={handleApplySuggestion}
                    loading={loading}
                  />
                </div>
              ))}
              {filteredData.length === 0 && <EmptyState message="Nenhum duplicado encontrado!" />}
            </div>
          ) : filteredData.length === 0 ? (
            <EmptyState message="Tudo limpo por aqui!" />
          ) : (
            <div className="border rounded-[24px] overflow-hidden bg-card shadow-sm">
              <AnomaliesTable 
                list={paginatedData} 
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                onDelete={handleDelete}
                onEdit={(c: any) => { setEditingId(c.id); setEditValue(c.whatsapp || c.phone || ""); }}
                onApplySuggestion={handleApplySuggestion}
                loading={loading}
                showMasterCheckbox={true}
                filteredData={filteredData}
              />
            </div>
          )}
        </div>

        {/* Audit Pagination Footer */}
        {activeTab !== "duplicates" && filteredData.length > pageSize && (
          <div className="px-8 py-4 border-t bg-muted/20 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Exibindo {Math.min(filteredData.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredData.length, currentPage * pageSize)} de {filteredData.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 rounded-xl" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  if (pageNum <= 0 || pageNum > totalPages) return null;
                  return (
                    <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" className="h-10 w-10 p-0 rounded-xl text-xs font-bold" onClick={() => setCurrentPage(pageNum)}>
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 rounded-xl" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Edit Modal (Inner) */}
        {editingId && (
          <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-md flex items-center justify-center p-4">
            <Card className="w-full max-w-md rounded-[32px] shadow-2xl border-none animate-in zoom-in-95">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6">Editar Número</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Telefone / WhatsApp</p>
                    <Input 
                      value={editValue} 
                      onChange={e => setEditValue(e.target.value)}
                      className="h-14 text-xl font-mono rounded-2xl border-none bg-muted/50 focus-visible:ring-primary/20"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button variant="ghost" className="h-12 rounded-2xl font-bold" onClick={() => setEditingId(null)}>Cancelar</Button>
                    <Button className="h-12 rounded-2xl font-bold" onClick={() => handleSaveEdit()}>Salvar Alteração</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bulk Action Confirmation */}
        {isBulkConfirmOpen && (
          <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-md flex items-center justify-center p-4">
            <Card className="w-full max-w-md rounded-[32px] shadow-2xl border-none animate-in zoom-in-95">
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center mb-6">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Confirmar Ação em Massa</h3>
                <p className="text-muted-foreground mb-8">
                  Você está prestes a {bulkAction === "apply" ? "aplicar sugestões em" : "excluir"} <strong>{selectedIds.length} contatos</strong>. Esta ação é irreversível.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="ghost" className="h-12 rounded-2xl font-bold" onClick={() => setIsBulkConfirmOpen(false)}>Cancelar</Button>
                  <Button variant="destructive" className="h-12 rounded-2xl font-bold" onClick={handleBulkAction}>Confirmar e Executar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-[100] bg-background/20 backdrop-blur-[1px] flex items-center justify-center">
            <div className="bg-card p-6 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 border border-primary/10 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <span className="text-sm font-black text-primary uppercase tracking-widest">Sincronizando...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  async function handleSaveEdit() {
    if (!editingId) return;
    setLoading(true);
    try {
      const cleanPhone = editValue.replace(/\D/g, "");
      const { error } = await supabase.from("clientes").update({ whatsapp: cleanPhone, telefone: cleanPhone }).eq("id", editingId);
      if (error) throw error;
      store.updateCustomer(editingId, { whatsapp: cleanPhone, phone: cleanPhone });
      setEditingId(null);
      toast.success("Número atualizado!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este contato?")) return;
    setLoading(true);
    try {
      await supabase.from("clientes").delete().eq("id", id);
      store.deleteCustomer(id);
      toast.success("Removido.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  }
}

function AnomaliesTable({ 
  list, selectedIds, setSelectedIds, onDelete, onEdit, 
  onApplySuggestion, loading, showMasterCheckbox, filteredData 
}: any) {
  return (
    <Table>
      <TableHeader className="bg-muted/40 h-14">
        <TableRow className="hover:bg-transparent border-none">
          <TableHead className="w-12 pl-6">
            {showMasterCheckbox && (
              <input 
                type="checkbox" 
                className="rounded border-muted-foreground/30 accent-primary"
                checked={selectedIds.length >= Math.min(filteredData.length, list.length) && list.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(list.map((d: any) => d.id));
                  else setSelectedIds([]);
                }}
              />
            )}
          </TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Contato</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Status / Inconsistência</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Número Atual</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Sugestão de Correção</TableHead>
          <TableHead className="text-right pr-6 font-bold text-xs uppercase tracking-widest text-muted-foreground">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((d: any) => (
          <TableRow key={d.id} className="group hover:bg-muted/10 h-20 transition-all border-muted/20">
            <TableCell className="pl-6">
              <input 
                type="checkbox" 
                className="rounded border-muted-foreground/30 accent-primary"
                checked={selectedIds.includes(d.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds([...selectedIds, d.id]);
                  else setSelectedIds(selectedIds.filter((id: string) => id !== d.id));
                }}
              />
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground/90">{d.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono uppercase">{d.cnpj || "CPF/Avulso"}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <AuditBadge severity={d.audit.severity} />
                {d.audit.issues.map((issue: any, idx: number) => (
                  <span key={idx} className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Info className="w-2.5 h-2.5 opacity-50" />
                    {issue.message}
                  </span>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 group/phone">
                <span className="font-mono text-sm tracking-tight">{d.whatsapp || d.phone}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/phone:opacity-100 transition-opacity rounded-lg" onClick={() => onEdit(d)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            </TableCell>
            <TableCell>
              {d.audit.suggestion ? (
                <button 
                  onClick={() => onApplySuggestion(d.id, d.audit.suggestion!)}
                  className="flex flex-col items-start gap-1 group/sug text-left hover:bg-primary/5 p-2 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-primary/80 font-bold tracking-tight">
                      {formatWithHighlight(d.audit.suggestion, d.audit.issues.find((i: any) => i.highlightRange)?.highlightRange)}
                    </span>
                    <div className="p-1 bg-primary/10 rounded-full group-hover/sug:bg-primary/20 transition-colors">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">Aplicar Sugestão</span>
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground/50 italic font-medium">Nenhuma sugestão</span>
              )}
            </TableCell>
            <TableCell className="text-right pr-6">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => onDelete(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6 dark:bg-green-950/20">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <h3 className="text-2xl font-bold mb-2">{message}</h3>
      <p className="text-muted-foreground max-w-sm">Nenhuma inconsistência encontrada para os filtros selecionados.</p>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colors: any = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    amber: "bg-amber-500/10 text-amber-500",
    purple: "bg-purple-500/10 text-purple-500",
    blue: "bg-blue-500/10 text-blue-500",
  };

  return (
    <div className="bg-background rounded-[24px] p-5 border shadow-sm group hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-xl transition-colors", colors[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <Badge variant="ghost" className="text-[10px] opacity-50 font-bold uppercase tracking-widest">Card</Badge>
      </div>
      <div className="space-y-0.5">
        <h4 className="text-3xl font-black tracking-tight">{value}</h4>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">{label}</p>
      </div>
    </div>
  );
}

function AuditBadge({ severity }: { severity: Severity }) {
  const configs: Record<Severity, { label: string; className: string }> = {
    CRITICAL: { label: "Crítico", className: "bg-red-500/10 text-red-600 border-red-200" },
    ATTENTION: { label: "Atenção", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
    DUPLICATE: { label: "Duplicado", className: "bg-purple-500/10 text-purple-600 border-purple-200" },
    OK: { label: "Válido", className: "bg-green-500/10 text-green-600 border-green-200" },
  };

  return (
    <Badge variant="outline" className={cn("rounded-md px-2 py-0 h-5 text-[9px] font-black uppercase tracking-widest", configs[severity].className)}>
      {configs[severity].label}
    </Badge>
  );
}

function formatWithHighlight(text: string, range?: [number, number]) {
  if (!range) return text;
  const start = range[0];
  const end = range[1];
  return (
    <>
      {text.substring(0, start)}
      <span className="bg-red-500/20 text-red-700 px-0.5 rounded mx-0.5 border border-red-200">{text.substring(start, end)}</span>
      {text.substring(end)}
    </>
  );
}

function ZapIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  );
}
