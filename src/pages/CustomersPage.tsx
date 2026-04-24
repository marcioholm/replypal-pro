import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, RegimeTributario, StatusCliente, Prioridade } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerForm } from "@/components/CustomerForm";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useCallback } from "react";
import { 
  Users, UserPlus, Search, Filter, 
  Building, BookOpen, Clock, AlertCircle,
  TrendingUp, ArrowRight, MoreHorizontal,
  ChevronRight, Calendar, Briefcase, FilterX,
  MapPin, Loader2
} from "lucide-react";

export default function CustomersPage() {
  const store = useStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regimeFilter, setRegimeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId) return;

      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("tenant_id", tenantId);

        if (data) {
          data.forEach(c => {
            store.addDbCustomer({
              id: c.id,
              name: c.nome_fantasia,
              razaoSocial: c.razao_social || "",
              cnpj: c.cnpj || "",
              responsible: c.responsavel || "",
              whatsapp: c.whatsapp || "",
              phone: c.telefone || "",
              email: c.email || "",
              city: c.cidade || "",
              state: c.estado || "",
              regime: c.regime_tributario as any,
              status: c.status as any,
              priority: (c.prioridade || "Média") as any,
              serviceLevel: (c.service_level || "Padrão") as any,
              plan: c.plan || "",
              origin: c.origin || "Direto",
              tenantId: c.tenant_id
            });
          });
        }
      } catch (err) {
        console.error("Erro ao carregar clientes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [user?.tenantId]);

  // Extract unique origins for the filter
  const origins = Array.from(new Set(store.customers.map(c => c.origin))).filter(Boolean);

  const filteredCustomers = store.customers.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.razaoSocial.toLowerCase().includes(search.toLowerCase()) || 
      c.cnpj.includes(search);
    
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesRegime = regimeFilter === "all" || c.regime === regimeFilter;
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    const matchesOrigin = originFilter === "all" || c.origin === originFilter;

    return matchesSearch && matchesStatus && matchesRegime && matchesPriority && matchesOrigin;
  });

  const statusColors = {
    "Ativo": "bg-success/20 text-success border-success/30",
    "Onboarding": "bg-info/20 text-info border-info/30",
    "Inativo": "bg-warning/20 text-warning border-warning/30",
    "Encerrado": "bg-destructive/20 text-destructive border-destructive/30",
  };

  const priorityColors = {
    "Alta": "text-destructive font-bold",
    "Média": "text-warning font-semibold",
    "Baixa": "text-info font-medium",
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Building className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Base de Clientes</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              Gestão operacional e contábil centralizada
            </p>
          </div>
        </div>
        
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95 px-6 gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Novo Cadastro de Cliente</DialogTitle>
              <CardDescription>Preencha os dados contábeis e de atendimento.</CardDescription>
            </DialogHeader>
            <div className="pt-4">
              <CustomerForm onSuccess={(c) => {
                setIsNewDialogOpen(false);
                navigate(`/customers/${c.id}`);
              }} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-none shadow-xl shadow-primary/5 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-3xl font-bold tracking-tight">{store.customers.length}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Total de clientes</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-xl shadow-success/5 group">
          <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-success/10 rounded-xl group-hover:bg-success/20 transition-colors">
                <AlertCircle className="w-5 h-5 text-success" />
              </div>
              <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">98%</span>
            </div>
            <p className="text-3xl font-bold text-success">{store.customers.filter(c => c.status === 'Ativo').length}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Clientes ativos</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-xl shadow-info/5 group">
          <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-info/10 rounded-xl group-hover:bg-info/20 transition-colors">
                <Clock className="w-5 h-5 text-info" />
              </div>
            </div>
            <p className="text-3xl font-bold text-info">{store.customers.filter(c => c.status === 'Onboarding').length}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Em onboarding</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-xl shadow-warning/5 group">
          <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-warning/10 rounded-xl group-hover:bg-warning/20 transition-colors">
                <BookOpen className="w-5 h-5 text-warning" />
              </div>
            </div>
            <p className="text-3xl font-bold text-warning">{store.customers.filter(c => c.serviceLevel === 'Estratégico').length}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Contas estratégicas</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
        <CardHeader className="bg-muted/20 pb-4 border-b">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Fantasia, Razão Social ou CNPJ..." 
                className="pl-9 bg-background border-muted-foreground/20 focus-visible:ring-primary h-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-medium">Filtros:</span>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px] bg-background text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {["Ativo", "Onboarding", "Inativo", "Encerrado"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={regimeFilter} onValueChange={setRegimeFilter}>
                <SelectTrigger className="h-9 w-[160px] bg-background text-xs"><SelectValue placeholder="Regime" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-background text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {["Baixa", "Média", "Alta"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-background text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>

              {(statusFilter !== "all" || regimeFilter !== "all" || priorityFilter !== "all" || originFilter !== "all" || search) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-9 text-xs text-muted-foreground hover:text-destructive gap-1"
                  onClick={() => { setSearch(""); setStatusFilter("all"); setRegimeFilter("all"); setPriorityFilter("all"); setOriginFilter("all"); }}
                >
                  <FilterX className="w-3.5 h-3.5" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/20 border-b-2 border-border/50">
                  <TableHead className="w-[280px] font-semibold py-4 pl-6 text-xs uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">CNPJ / Localização</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Atendente</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Origem</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Prioridade</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground">Nenhum cliente encontrado com os filtros selecionados.</TableCell></TableRow>
                ) : (
                  filteredCustomers.map((c) => (
                    <TableRow key={c.id} className="group hover:bg-muted/30 transition-all cursor-pointer border-b border-border/30" onClick={() => navigate(`/customers/${c.id}`)}>
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg transform group-hover:scale-105 transition-transform ${
                             c.status === 'Ativo' ? 'bg-gradient-to-br from-primary to-primary/60' : 'bg-muted-foreground/40'
                          }`}>
                            {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm tracking-tight truncate">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium truncate">{c.razaoSocial}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-xs font-mono text-foreground font-medium">{c.cnpj}</p>
                          <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.city} - {c.state}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground">
                             {store.users.find(u => u.id === c.attendantId)?.name[0]}
                           </div>
                           <p className="text-xs font-medium">{store.users.find(u => u.id === c.attendantId)?.name || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className="text-[10px] font-medium bg-muted/50 border-muted-foreground/20">{c.origin}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-md border shadow-sm ${statusColors[c.status]}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-[11px] font-medium ${priorityColors[c.priority]}`}>{c.priority}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                         <Button variant="ghost" size="sm" className="group-hover:translate-x-1 transition-transform h-8 w-8 p-0">
                           <ChevronRight className="w-4 h-4 text-primary" />
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
    </div>
  );
}
