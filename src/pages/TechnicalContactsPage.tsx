import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, PillToggle } from "@/components/conta-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShieldCheck, AlertCircle, AlertTriangle, 
  CheckCircle2, Phone, Search, Download, 
  RefreshCw, Layers, ChevronLeft, ChevronRight,
  Filter, Smartphone, Home, XCircle, Info, Edit2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TechnicalContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    fetchContacts();
  }, [user?.tenantId]);

  const fetchContacts = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar contatos técnicos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTrigger = async (isDryRun = false) => {
    if (!user?.tenantId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/sync-evolution-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: user.tenantId, dryRun: isDryRun })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro na sincronização");

      setSyncResult(result);
      toast.success(result.message);
      
      if (!isDryRun) setTimeout(fetchContacts, 2000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const dismissSyncResult = useCallback(() => setSyncResult(null), []);

  const metrics = useMemo(() => {
    const total = contacts.length;
    const movel = contacts.filter(c => c.tipo_numero === "MOVEL").length;
    const fixo = contacts.filter(c => c.tipo_numero === "FIXO").length;
    const invalid = contacts.filter(c => (c.status_validacao === "INVALIDO" || c.tipo_numero === "INVALIDO")).length;
    const missing9 = contacts.filter(c => c.status_validacao === "SEM_NONO_DIGITO").length;
    const excess = contacts.filter(c => c.status_validacao === "DIGITOS_EXCEDENTES").length;
    const pending = contacts.filter(c => c.status_validacao === "PENDENTE_REVISAO").length;

    return { total, movel, fixo, invalid, missing9, excess, pending };
  }, [contacts]);

  const filteredData = useMemo(() => {
    let data = contacts;

    if (activeTab === "movel") data = data.filter(d => d.tipo_numero === "MOVEL");
    else if (activeTab === "fixo") data = data.filter(d => d.tipo_numero === "FIXO");
    else if (activeTab === "invalid") data = data.filter(d => d.status_validacao === "INVALIDO" || d.tipo_numero === "INVALIDO");
    else if (activeTab === "missing9") data = data.filter(d => d.status_validacao === "SEM_NONO_DIGITO");
    else if (activeTab === "excess") data = data.filter(d => d.status_validacao === "DIGITOS_EXCEDENTES");
    else if (activeTab === "pending") data = data.filter(d => d.status_validacao === "PENDENTE_REVISAO");

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(d => 
        (d.nome || "").toLowerCase().includes(s) || 
        (d.telefone || "").includes(s) ||
        (d.telefone_formatado || "").includes(s)
      );
    }

    return data;
  }, [contacts, activeTab, search]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    return filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredData, currentPage]);

  const getValidationBadge = (status: string) => {
    switch (status) {
      case "VALIDO":
        return <Chip tone="green"><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Válido</Chip>;
      case "SEM_NONO_DIGITO":
        return <Chip tone="amber"><AlertCircle className="w-3 h-3 mr-1 inline" /> Sem 9º Dígito</Chip>;
      case "DIGITOS_EXCEDENTES":
        return <Chip tone="blue"><Layers className="w-3 h-3 mr-1 inline" /> Excedente</Chip>;
      case "INVALIDO":
        return <Chip tone="red"><XCircle className="w-3 h-3 mr-1 inline" /> Inválido</Chip>;
      default:
        return <Chip tone="grey"><Info className="w-3 h-3 mr-1 inline" /> {status}</Chip>;
    }
  };

  return (
    <div className="flex flex-col gap-5 px-8 pb-8 pt-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSyncTrigger(true)} disabled={syncing} className="gap-1.5 text-xs">
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            Dry Run
          </Button>
          <Button variant="default" onClick={() => handleSyncTrigger(false)} disabled={syncing} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && syncResult.stats && !syncResult.dryRun && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Sincronização concluída
            </h3>
            <Button variant="ghost" size="sm" onClick={dismissSyncResult} className="h-6 w-6 p-0">
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-background/80 rounded-xl p-2.5">
              <p className="text-muted-foreground">Contatos</p>
              <p className="font-bold text-lg">{syncResult.stats.atualizados_contacts}</p>
            </div>
            <div className="bg-background/80 rounded-xl p-2.5">
              <p className="text-muted-foreground">Conversas</p>
              <p className="font-bold text-lg">{syncResult.stats.atualizados_conversas}</p>
            </div>
            <div className="bg-background/80 rounded-xl p-2.5">
              <p className="text-muted-foreground">Fotos no Storage</p>
              <p className="font-bold text-lg">{syncResult.stats.salvos_storage}</p>
            </div>
            <div className="bg-background/80 rounded-xl p-2.5">
              <p className="text-muted-foreground">Sem foto</p>
              <p className="font-bold text-lg">{syncResult.stats.sem_foto}</p>
            </div>
          </div>
          {syncResult.stats.erros > 0 && (
            <p className="text-xs text-destructive font-medium">{syncResult.stats.erros} erro(s)</p>
          )}
        </div>
      )}

      {syncResult && syncResult.dryRun && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-500" />
              Dry Run: {syncResult.stats?.contacts_encontrados} contatos encontrados
            </p>
            <Button variant="ghost" size="sm" onClick={dismissSyncResult} className="h-6 w-6 p-0">
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl bg-card border-0 shadow-none hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sincronizado</p>
                <h3 className="text-2xl font-bold">{metrics.total}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-card border-0 shadow-none hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Celulares Válidos</p>
                <h3 className="text-2xl font-bold text-emerald-500">{metrics.movel}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-card border-0 shadow-none hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fixos / Corporativos</p>
                <h3 className="text-2xl font-bold text-amber-500">{metrics.fixo}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Home className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-card border-0 shadow-none hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Problemas Críticos</p>
                <h3 className="text-2xl font-bold text-destructive">{metrics.invalid + metrics.missing9}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="rounded-xl bg-card border-0 shadow-none">
        <CardHeader className="p-0 border-b border-border/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 gap-4">
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <PillToggle active={activeTab === 'all'} onClick={() => setActiveTab('all')}>Todos</PillToggle>
              <PillToggle active={activeTab === 'movel'} onClick={() => setActiveTab('movel')}>Celulares</PillToggle>
              <PillToggle active={activeTab === 'fixo'} onClick={() => setActiveTab('fixo')}>Fixos</PillToggle>
              <PillToggle active={activeTab === 'invalid'} onClick={() => setActiveTab('invalid')}>Inválidos</PillToggle>
              <PillToggle active={activeTab === 'missing9'} onClick={() => setActiveTab('missing9')}>Sem 9º</PillToggle>
              <PillToggle active={activeTab === 'excess'} onClick={() => setActiveTab('excess')}>Excedentes</PillToggle>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-96">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome ou telefone..." 
                  className="pl-10 bg-muted/30 border-border/50 focus:bg-background transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Contato</TableHead>
                  <TableHead>Telefone Original</TableHead>
                  <TableHead>Formatado (DDI+DDD)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status Validação</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead className="text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j} className="h-16 animate-pulse bg-muted/20" />
                      ))}
                    </TableRow>
                  ))
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Search className="w-12 h-12 opacity-20" />
                        <p>Nenhum contato encontrado com os filtros atuais.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((contact) => (
                    <TableRow key={contact.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary overflow-hidden">
                            {contact.foto_perfil ? (
                              <img src={contact.foto_perfil} alt={contact.nome} className="w-full h-full object-cover" />
                            ) : (
                              (contact.nome || "C")[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{contact.nome || "Sem Nome"}</p>
                            <p className="text-xs text-muted-foreground">ID: {contact.jid.split('@')[0]}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{contact.telefone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-mono text-xs text-primary">
                          <span className="opacity-50">{contact.ddi}</span>
                          <span className="font-bold">{contact.ddd}</span>
                          <span>{contact.telefone_formatado?.substring(4)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.tipo_numero === "MOVEL" ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                            Celular
                          </div>
                        ) : contact.tipo_numero === "FIXO" ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Home className="w-3.5 h-3.5 text-amber-500" />
                            Fixo
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Outro
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getValidationBadge(contact.status_validacao)}
                          {contact.motivo_validacao && (
                            <p className="text-[10px] text-muted-foreground pl-1">{contact.motivo_validacao}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip tone="grey">{contact.instance_name || "Desconhecida"}</Chip>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filteredData.length)} de {filteredData.length} contatos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{currentPage}</span>
              <span className="text-sm text-muted-foreground">de {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
