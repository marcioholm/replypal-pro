import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, Customer, WhatsappStatus } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { analyzeContact, AuditResult } from "@/lib/contactAudit";
import { checkWhatsappNumber } from "@/lib/whatsappCheck";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, AlertCircle, AlertTriangle, 
  CheckCircle2, Phone, Search, Download, 
  RefreshCw, Layers, ChevronLeft, ChevronRight,
  Filter, Smartphone, Home, XCircle, Info, Edit2,
  Trash2, Check, Zap, Merge, ArrowRight, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnomaliesTable } from "@/components/clientes/AnomaliesTable";

export default function HygienePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const store = useStore();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState({ current: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageSize = 30;

  useEffect(() => {
    const fetchCustomers = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId) return;

      setLoading(true);
      
      // Limpar usando o método correto para notificar a UI
      store.customers = [];
      // Se houver um método clear no store, use-o, senão force o recarregamento via addDbCustomer
      
      try {
        let from = 0;
        const step = 1000;
        let hasMore = true;
        let totalLoaded = 0;

        while (hasMore) {
          const { data, error } = await supabase
            .from("clientes")
            .select("*")
            .eq("tenant_id", tenantId)
            .range(from, from + step - 1)
            .order("nome_fantasia", { ascending: true });

          if (error) throw error;
          
          if (data && data.length > 0) {
            const mappedBatch = data.map(c => ({
              id: c.id,
              name: c.nome_fantasia || c.razao_social || "Sem Nome",
              razaoSocial: c.razao_social || "",
              cnpj: c.cnpj || "",
              responsibleName: c.responsavel || "",
              whatsapp: c.whatsapp || "",
              phone: c.telefone || "",
              email: c.email || "",
              city: c.cidade || "",
              state: c.estado || "",
              regime: c.regime_tributario as any,
              status: c.status as any,
              priority: (c.prioridade || "Média") as any,
              tenantId: c.tenant_id,
              operational_status: c.operational_status as any,
              internal_responsible_name: c.internal_responsible_name,
              sector: c.sector as any,
              fantasy_name: c.nome_fantasia,
              whatsapp_status: c.whatsapp_status,
              createdAt: new Date(c.created_at)
            }));

            // Adicionar ao store lote por lote para a UI não travar
            mappedBatch.forEach(item => store.addDbCustomer(item));
            
            totalLoaded += data.length;
            from += step;
            if (data.length < step) hasMore = false;
            if (totalLoaded > 15000) hasMore = false; 
          } else {
            hasMore = false;
          }
        }
      } catch (err) {
        console.error("Erro ao carregar higiene em lotes:", err);
        toast.error("Erro ao carregar base completa.");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [user?.tenantId]);

  const handleApplyBulkSuggestions = async () => {
    const toApply = auditData.filter(d => selectedIds.includes(d.id) && d.audit.suggestion);
    if (toApply.length === 0) {
      toast.info("Nenhum dos selecionados tem sugestão disponível.");
      return;
    }

    if (!confirm(`Deseja aplicar sugestões de correção em ${toApply.length} contatos?`)) return;

    setLoading(true);
    let count = 0;
    try {
      for (const item of toApply) {
        const { error } = await supabase
          .from("clientes")
          .update({ whatsapp: item.audit.suggestion })
          .eq("id", item.id);
        
        if (!error) {
          store.updateCustomer(item.id, { whatsapp: item.audit.suggestion });
          count++;
        }
      }
      toast.success(`${count} contatos atualizados com sucesso!`);
      setSelectedIds([]);
    } catch (err) {
      toast.error("Erro ao aplicar em massa.");
    } finally {
      setLoading(false);
    }
  };

  const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0 });
  const [isMerging, setIsMerging] = useState(false);

  const handleBulkMergeDuplicates = async () => {
    const selectedDuplicates = auditData.filter(d => selectedIds.includes(d.id) && d.audit.isDuplicate);
    if (selectedDuplicates.length === 0) {
      toast.info("Nenhum duplicado selecionado.");
      return;
    }

    if (!confirm(`Deseja unificar os ${selectedDuplicates.length} registros duplicados selecionados? O sistema manterá o registro mais antigo como principal para cada grupo.`)) return;

    setLoading(true);
    setIsMerging(true);
    setMergeProgress({ current: 0, total: selectedDuplicates.length });
    
    let count = 0;
    try {
      // Agrupar por telefone para processar
      const groups = new Map<string, any[]>();
      selectedDuplicates.forEach(d => {
        const phone = d.audit.normalizedPhone;
        if (!groups.has(phone)) groups.set(phone, []);
        groups.get(phone)?.push(d);
      });

      let currentProcessed = 0;
      for (const [phone, items] of groups.entries()) {
        // Buscar o "Master" (o mais antigo da base inteira com esse telefone)
        const allWithThisPhone = auditData.filter(c => c.audit.normalizedPhone === phone)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const master = allWithThisPhone[0];
        const toMerge = items.filter(i => i.id !== master.id);

        for (const item of toMerge) {
          const { error } = await supabase
            .from("clientes")
            .update({ 
              status: "Encerrado",
              observations: (item.observations || "") + `\n[SISTEMA] Mesclado com duplicado master ID: ${master.id}`
            })
            .eq("id", item.id);
          
          if (!error) {
            store.updateCustomer(item.id, { status: "Encerrado" });
            count++;
          }
          currentProcessed++;
          setMergeProgress({ current: currentProcessed, total: selectedDuplicates.length });
        }
      }
      toast.success(`${count} registros unificados com sucesso!`);
      setSelectedIds([]);
    } catch (err) {
      toast.error("Erro ao unificar duplicados.");
    } finally {
      setLoading(false);
      setIsMerging(false);
      setMergeProgress({ current: 0, total: 0 });
    }
  };

  const handleMergeAllDuplicates = async () => {
    const allDuplicates = auditData.filter(d => d.audit.isDuplicate);
    if (allDuplicates.length === 0) {
      toast.info("Nenhum duplicado encontrado na base atual.");
      return;
    }

    if (!confirm(`ATENÇÃO: Deseja unificar TODOS os ${metrics.duplicates} registros duplicados encontrados na base? Esta ação manterá apenas o registro mais antigo de cada número e arquivará os demais.`)) return;

    setLoading(true);
    setIsMerging(true);
    setMergeProgress({ current: 0, total: allDuplicates.length });
    
    let count = 0;
    try {
      const groups = new Map<string, any[]>();
      allDuplicates.forEach(d => {
        const phone = d.audit.normalizedPhone;
        if (!groups.has(phone)) groups.set(phone, []);
        groups.get(phone)?.push(d);
      });

      let currentProcessed = 0;
      for (const [phone, items] of groups.entries()) {
        const allWithThisPhone = auditData.filter(c => c.audit.normalizedPhone === phone)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const master = allWithThisPhone[0];
        // No "Merge All", queremos processar todos os duplicados que não são o master
        const toMerge = allWithThisPhone.slice(1);

        for (const item of toMerge) {
          const { error } = await supabase
            .from("clientes")
            .update({ 
              status: "Encerrado",
              observations: (item.observations || "") + `\n[SISTEMA] Mesclado via Limpeza Global. Master: ${master.id}`
            })
            .eq("id", item.id);
          
          if (!error) {
            store.updateCustomer(item.id, { status: "Encerrado" });
            count++;
          }
        }
        currentProcessed += items.length;
        setMergeProgress({ current: Math.min(currentProcessed, allDuplicates.length), total: allDuplicates.length });
      }
      toast.success(`${count} duplicados unificados globalmente!`);
    } catch (err) {
      toast.error("Erro na limpeza global.");
    } finally {
      setLoading(false);
      setIsMerging(false);
      setMergeProgress({ current: 0, total: 0 });
    }
  };

  const auditData = useMemo(() => {
    return store.customers
      .filter(c => c.status !== "Encerrado") // Esconder contatos já resolvidos/arquivados da auditoria
      .map(c => ({
        ...c,
        audit: analyzeContact(c, store.customers)
      }));
  }, [store.customers]);

  const metrics = useMemo(() => {
    const total = auditData.length;
    const valid = auditData.filter(c => c.audit.severity === "OK").length;
    const critical = auditData.filter(c => c.audit.severity === "CRITICAL").length;
    const attention = auditData.filter(c => c.audit.severity === "ATTENTION").length;
    const fixed = auditData.filter(c => c.audit.isLandline).length;
    const duplicates = auditData.filter(c => c.audit.isDuplicate).length;
    const withSuggestions = auditData.filter(c => c.audit.suggestion).length;
    const withWhatsapp = auditData.filter(c => c.whatsapp_status === "possui WhatsApp").length;
    const noWhatsapp = auditData.filter(c => c.whatsapp_status === "não possui WhatsApp").length;
    const notChecked = auditData.filter(c => !c.whatsapp_status || c.whatsapp_status === "não verificado").length;
    const qualityScore = total > 0 ? Math.round((valid / total) * 100) : 100;

    return { total, valid, critical, attention, fixed, duplicates, withSuggestions, withWhatsapp, noWhatsapp, notChecked, qualityScore };
  }, [auditData]);

  const filteredData = useMemo(() => {
    let data = auditData;

    if (activeTab === "duplicates") data = data.filter(d => d.audit.isDuplicate);
    else if (activeTab === "critical") data = data.filter(d => d.audit.severity === "CRITICAL");
    else if (activeTab === "attention") data = data.filter(d => d.audit.severity === "ATTENTION");
    else if (activeTab === "fixed") data = data.filter(d => d.audit.isLandline);
    else if (activeTab === "whatsapp") data = data.filter(d => d.whatsapp_status && d.whatsapp_status !== "não verificado");
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
      toast.success("Sugestão aplicada!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckWhatsapp = async (id: string, phone: string) => {
    setLoading(true);
    try {
      const result = await checkWhatsappNumber(phone);
      await supabase.from("clientes").update({
        whatsapp_status: result.status,
        whatsapp_checked_at: result.checked_at,
        whatsapp_check_provider: result.provider
      }).eq("id", id);

      store.updateCustomer(id, { 
        whatsapp_status: result.status as any,
        whatsapp_checked_at: new Date(result.checked_at)
      });
      toast.success(result.status === "possui WhatsApp" ? "WhatsApp validado!" : "Número sem WhatsApp.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalWhatsappAudit = async () => {
    const toCheck = auditData.filter(d => !d.whatsapp_status || d.whatsapp_status === "não verificado");
    if (toCheck.length === 0) {
      toast.info("Todos os números já foram verificados.");
      return;
    }

    setIsVerifying(true);
    setVerificationProgress({ current: 0, total: toCheck.length });

    try {
      for (let i = 0; i < toCheck.length; i++) {
        const item = toCheck[i];
        const phone = item.whatsapp || item.phone;
        if (!phone) continue;

        setVerificationProgress({ current: i + 1, total: toCheck.length });
        const result = await checkWhatsappNumber(phone);
        
        await supabase.from("clientes").update({
          whatsapp_status: result.status,
          whatsapp_checked_at: result.checked_at,
          whatsapp_check_provider: result.provider
        }).eq("id", item.id);

        store.updateCustomer(item.id, { 
          whatsapp_status: result.status as any,
          whatsapp_checked_at: new Date(result.checked_at)
        });

        // Delay para evitar bloqueios
        await new Promise(r => setTimeout(r, 300));
      }
      toast.success("Auditoria global de WhatsApp concluída!");
    } catch (err: any) {
      toast.error("Erro na auditoria global: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleMerge = async (id: string) => {
    const customer = store.customers.find(c => c.id === id);
    if (!customer) return;
    const phone = (customer.whatsapp || customer.phone || "").replace(/\D/g, "");
    if (!phone) return;

    const duplicates = store.customers.filter(c => 
      c.id !== id && 
      (c.whatsapp?.replace(/\D/g, "") === phone || c.phone?.replace(/\D/g, "") === phone)
    );

    if (duplicates.length === 0) {
      toast.info("Nenhuma duplicata encontrada para mesclar.");
      return;
    }

    if (!confirm(`Deseja mesclar este contato com outras ${duplicates.length} duplicatas? Os outros registros serão removidos.`)) return;

    setLoading(true);
    try {
      const idsToDelete = duplicates.map(d => d.id);
      const { error } = await supabase.from('clientes').delete().in('id', idsToDelete);
      if (error) throw error;

      idsToDelete.forEach(id => store.deleteCustomer(id));
      toast.success(`${duplicates.length} duplicatas removidas.`);
    } catch (err: any) {
      toast.error("Erro ao mesclar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este contato?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      store.deleteCustomer(id);
      toast.success("Contato excluído.");
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50/50 dark:bg-slate-950/50 animate-in fade-in duration-700">
      {/* Top Banner/Header */}
      <div className="bg-white dark:bg-slate-900 border-b px-8 py-6 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")} className="rounded-2xl bg-slate-100 hover:bg-slate-200 transition-all h-12 w-12">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="h-12 w-px bg-slate-200 hidden md:block" />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Auditoria Inteligente</h1>
              </div>
              <p className="text-sm text-slate-500 font-medium">Higiene e validação completa da base de contatos contábeis</p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-[24px] flex items-center gap-6 shadow-inner border">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Qualidade da Base</p>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000",
                        metrics.qualityScore > 80 ? "bg-green-500" : metrics.qualityScore > 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${metrics.qualityScore}%` }}
                    />
                  </div>
                  <span className="text-xl font-black text-slate-700 dark:text-slate-200">{metrics.qualityScore}%</span>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={handleMergeAllDuplicates}
                disabled={loading || metrics.duplicates === 0}
                className="rounded-2xl h-14 px-6 gap-2 font-bold border-2 border-purple-500/20 text-purple-600 hover:bg-purple-50 transition-all hover:scale-105 active:scale-95"
              >
                <Zap className="w-5 h-5" />
                Limpeza Automática
              </Button>
              <Button 
                onClick={handleGlobalWhatsappAudit} 
                disabled={isVerifying}
                className="rounded-2xl h-14 px-6 gap-2 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                {isVerifying ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                Audit WhatsApp All
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-[1600px] mx-auto space-y-8">
          {/* Floating Bulk Actions Bar */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
              <div className="bg-slate-900 text-white px-8 py-5 rounded-[32px] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center font-black text-lg">
                    {selectedIds.length}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Selecionados</span>
                    <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Ação em massa disponível</span>
                  </div>
                </div>

                <div className="h-10 w-px bg-white/10" />

                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleApplyBulkSuggestions}
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-12 px-6 gap-2 font-bold transition-all active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Aplicar Sugestões
                  </Button>

                  <Button 
                    onClick={handleBulkMergeDuplicates}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl h-12 px-6 gap-2 font-bold transition-all active:scale-95"
                  >
                    <Zap className="w-4 h-4" />
                    Mesclar Duplicados
                  </Button>
                  
                  <Button 
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir ${selectedIds.length} contatos permanentemente?`)) {
                        // Implementar delete mass se necessário
                        toast.info("Ação de exclusão em massa.");
                      }
                    }}
                    className="hover:bg-red-500/10 text-red-400 hover:text-red-400 rounded-2xl h-12 px-6 gap-2 font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Selecionados
                  </Button>

                  <Button 
                    variant="ghost"
                    onClick={() => setSelectedIds([])}
                    className="hover:bg-white/10 text-white rounded-2xl h-12 px-6 font-bold transition-all"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Progress Overlay if verifying */}
          {isVerifying && (
            <Card className="border-primary/20 bg-primary/5 shadow-xl animate-in zoom-in-95 duration-300 rounded-[32px] overflow-hidden border-2">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-primary">Auditando WhatsApp Globalmente...</p>
                      <p className="text-sm text-primary/60 font-medium">Verificando existência e status de cada número na base</p>
                    </div>
                  </div>
                  <Badge className="bg-primary text-white font-black px-4 py-1.5 rounded-full text-sm">
                    {verificationProgress.current} / {verificationProgress.total}
                  </Badge>
                </div>
                <Progress value={(verificationProgress.current / verificationProgress.total) * 100} className="h-4 bg-primary/10" />
              </CardContent>
            </Card>
          )}

          {/* Progress Overlay if merging */}
          {isMerging && (
            <Card className="border-purple-500/20 bg-purple-500/5 shadow-xl animate-in zoom-in-95 duration-300 rounded-[32px] overflow-hidden border-2">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/10 rounded-2xl">
                      <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-purple-600">Unificando Contatos Duplicados...</p>
                      <p className="text-sm text-purple-600/60 font-medium">Consolidando registros e mantendo histórico principal</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-600 text-white font-black px-4 py-1.5 rounded-full text-sm">
                    {mergeProgress.current} / {mergeProgress.total}
                  </Badge>
                </div>
                <Progress value={(mergeProgress.current / mergeProgress.total) * 100} className="h-4 bg-purple-500/10" />
              </CardContent>
            </Card>
          )}

          {/* New Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
             <MetricCard label="Total" value={metrics.total} icon={Layers} color="slate" />
             <MetricCard label="Válidos" value={metrics.valid} icon={CheckCircle2} color="green" />
             <MetricCard label="Críticos" value={metrics.critical} icon={AlertCircle} color="red" />
             <MetricCard label="Atenção" value={metrics.attention} icon={AlertTriangle} color="amber" />
             <MetricCard label="Duplicados" value={metrics.duplicates} icon={Merge} color="purple" />
             <MetricCard label="Fixos" value={metrics.fixed} icon={Phone} color="blue" />
             <MetricCard label="Com WhatsApp" value={metrics.withWhatsapp} icon={ShieldCheck} color="green" />
             <MetricCard label="Sugestões" value={metrics.withSuggestions} icon={Zap} color="blue" />
          </div>

          {/* Main Content Area */}
          <Card className="border-none shadow-2xl shadow-black/5 rounded-[40px] overflow-hidden bg-white dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="p-8 border-b bg-slate-50/50">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-slate-200/50 p-1.5 rounded-2xl">
                  <TabsList className="bg-transparent h-10 gap-1">
                    <TabItem value="all" label="Todos" count={metrics.total} />
                    <TabItem value="critical" label="Críticos" count={metrics.critical} color="text-red-500" />
                    <TabItem value="attention" label="Atenção" count={metrics.attention} color="text-amber-500" />
                    <TabItem value="duplicates" label="Duplicados" count={metrics.duplicates} color="text-purple-500" />
                    <TabItem value="fixed" label="Fixos" count={metrics.fixed} color="text-blue-500" />
                    <TabItem value="whatsapp" label="WhatsApp" count={metrics.withWhatsapp} color="text-green-500" />
                    <TabItem value="suggestions" label="Sugestões" count={metrics.withSuggestions} color="text-primary" />
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input 
                      placeholder="Buscar por nome ou telefone..." 
                      className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-sm focus:ring-primary focus:border-primary text-lg"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" className="h-14 w-14 rounded-2xl border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                    <Download className="w-6 h-6 text-slate-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="min-h-[500px]">
                <AnomaliesTable 
                  list={paginatedData} 
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  onDelete={handleDelete}
                  onEdit={() => {}}
                  onApplySuggestion={handleApplySuggestion}
                  onCheckWhatsapp={handleCheckWhatsapp}
                  onMerge={handleMerge}
                  loading={loading}
                  showMasterCheckbox={true}
                  filteredData={filteredData}
                  showWhatsappStatus={activeTab === "whatsapp"}
                />
              </div>

              {/* Pagination */}
              {filteredData.length > pageSize && (
                <div className="p-8 border-t bg-slate-50/50 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                    Exibindo {Math.min(filteredData.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredData.length, currentPage * pageSize)} de {filteredData.length} registros
                  </p>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="h-12 w-12 rounded-2xl border-slate-200" 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = currentPage;
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        if (pageNum <= 0 || pageNum > totalPages) return null;
                        return (
                          <Button 
                            key={pageNum} 
                            variant={currentPage === pageNum ? "default" : "outline"} 
                            className={cn("h-12 w-12 rounded-2xl font-black text-sm transition-all", currentPage === pageNum ? "shadow-lg shadow-primary/20 scale-110" : "border-slate-200")}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button 
                      variant="outline" 
                      className="h-12 w-12 rounded-2xl border-slate-200" 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    slate: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    green: "bg-green-500/10 text-green-600 border-green-500/20",
    red: "bg-red-500/10 text-red-600 border-red-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    primary: "bg-primary/10 text-primary border-primary/20",
  };

  return (
    <Card className={cn("border-none shadow-lg shadow-black/5 transition-all hover:scale-105 duration-300 overflow-hidden group")}>
      <CardContent className="p-6 relative">
        <div className={cn("absolute top-0 right-0 p-2 rounded-bl-3xl opacity-10 transition-opacity group-hover:opacity-20", colors[color])}>
           <Icon className="w-12 h-12" />
        </div>
        <div className="flex flex-col gap-1 relative z-10">
          <p className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white">{value}</p>
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", colors[color])} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TabItem({ value, label, count, color }: any) {
  return (
    <TabsTrigger 
      value={value} 
      className="rounded-xl px-4 font-bold text-xs gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
    >
      <span className={cn(color)}>{label}</span>
      <Badge variant="secondary" className="bg-slate-100 text-[10px] px-1.5 py-0 rounded-md font-black">{count}</Badge>
    </TabsTrigger>
  );
}
