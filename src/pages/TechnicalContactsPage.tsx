import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

  const metrics = useMemo(() => {
    const total = contacts.length;
    const movel = contacts.filter(c => c.tipo_numero === "MOVEL").length;
    const fixo = contacts.filter(c => c.tipo_numero === "FIXO").length;
    const invalid = contacts.filter(c => c.status_validacao === "INVALIDO").length;
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
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"><CheckCircle2 className="w-3 h-3" /> Válido</Badge>;
      case "SEM_NONO_DIGITO":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1"><AlertCircle className="w-3 h-3" /> Sem 9º Dígito</Badge>;
      case "DIGITOS_EXCEDENTES":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 gap-1"><Layers className="w-3 h-3" /> Excedente</Badge>;
      case "INVALIDO":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><XCircle className="w-3 h-3" /> Inválido</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 gap-1"><Info className="w-3 h-3" /> {status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")} className="h-8 px-2 -ml-2 gap-1 text-xs">
              <ChevronLeft className="w-3 h-3" /> Voltar
            </Button>
            <span className="text-xs">/</span>
            <span className="text-xs">Central Técnica</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Contatos Inteligentes
          </h1>
          <p className="text-muted-foreground">
            Gestão técnica e higienização da base sincronizada via WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchContacts} disabled={loading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sincronizar Agora
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sincronizado</p>
                <h3 className="text-2xl font-bold">{metrics.total}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Celulares Válidos</p>
                <h3 className="text-2xl font-bold text-emerald-500">{metrics.movel}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fixos / Corporativos</p>
                <h3 className="text-2xl font-bold text-amber-500">{metrics.fixo}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Home className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Problemas Críticos</p>
                <h3 className="text-2xl font-bold text-destructive">{metrics.invalid + metrics.missing9}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="p-0 border-b border-border/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="all" className="gap-2">Todos</TabsTrigger>
                <TabsTrigger value="movel" className="gap-2">Celulares</TabsTrigger>
                <TabsTrigger value="fixo" className="gap-2">Fixos</TabsTrigger>
                <TabsTrigger value="invalid" className="gap-2 text-destructive">Inválidos</TabsTrigger>
                <TabsTrigger value="missing9" className="gap-2 text-amber-500">Sem 9º</TabsTrigger>
                <TabsTrigger value="excess" className="gap-2 text-purple-500">Excedentes</TabsTrigger>
              </TabsList>
            </Tabs>

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
                        <Badge variant="secondary" className="font-normal text-[10px]">{contact.instance_name || "Desconhecida"}</Badge>
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
