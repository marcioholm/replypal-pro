import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ContactImportDialog } from "@/components/clientes/ContactImportDialog";
import { SimpleContactDialog } from "@/components/clientes/SimpleContactDialog";
import { SmartHygieneDialog } from "@/components/clientes/SmartHygieneDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { 
  Users, Search, Filter, 
  MessageSquare, ChevronRight, FilterX,
  Loader2, ChevronLeft, Building2,  UserCog, ClipboardList, Info, Mail, PhoneCall, ShieldCheck
} from "lucide-react";

export default function ContactsPage() {
  const store = useStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  useEffect(() => {
    const fetchCustomers = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId || tenantId.length < 5) return;

      try {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let finished = false;

        while (!finished) {
          const { data, error } = await supabase
            .from("clientes")
            .select("*")
            .eq("tenant_id", tenantId)
            .range(from, to);

          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < 1000) {
              finished = true;
            } else {
              from += 1000;
              to += 1000;
            }
          } else {
            finished = true;
          }
        }

        if (allData.length > 0) {
          allData.forEach(c => {
            store.addDbCustomer({
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
            });
          });
        }
      } catch (err) {
        console.error("Erro ao carregar contatos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [user?.tenantId]);

  const allContacts = store.customers
    .filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.razaoSocial?.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj?.includes(search) ||
      c.whatsapp.includes(search)
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const insights = {
    missingFinance: store.customers.filter(c => !c.sector || c.sector === "Fiscal").length,
    invalidPhones: store.customers.filter(c => c.whatsapp_status === "não possui WhatsApp").length,
    notReviewed: store.customers.filter(c => c.operational_status === "Revisão pendente").length,
    total: allContacts.length
  };

  const totalPages = Math.ceil(allContacts.length / pageSize);
  const paginatedContacts = allContacts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Users className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Central Operacional de Contatos</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5" />
              Gestão de relacionamento e auditoria cadastral contábil
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => navigate("/contacts/hygiene")} 
            className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl px-4 font-bold shadow-sm"
            variant="outline"
          >
            <ShieldCheck className="h-4 w-4" />
            Auditoria de Contatos
          </Button>
          <SimpleContactDialog onSuccess={() => {}} />
          <ContactImportDialog onSuccess={() => window.location.reload()} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard 
          label="Revisão Pendente" 
          value={insights.notReviewed} 
          icon={ClipboardList} 
          color="amber" 
          description="Contatos aguardando validação"
        />
        <InsightCard 
          label="Sem WhatsApp" 
          value={insights.invalidPhones} 
          icon={FilterX} 
          color="red" 
          description="Números não identificados"
        />
        <InsightCard 
          label="Sem Contato Financeiro" 
          value={insights.missingFinance} 
          icon={Building2} 
          color="blue" 
          description="Empresas com lacuna setorial"
        />
        <InsightCard 
          label="Total de Registros" 
          value={insights.total} 
          icon={Users} 
          color="primary" 
          description="Base total auditada"
        />
      </div>

      <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
        <CardHeader className="bg-muted/20 pb-4 border-b">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome, empresa, CNPJ ou telefone..." 
                className="pl-9 bg-background border-muted-foreground/20 focus-visible:ring-primary h-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button variant="outline" className="h-11 px-4 gap-2 border-muted-foreground/20 flex-1 md:flex-none">
                <Filter className="w-4 h-4" />
                Filtros Avançados
              </Button>
              <Button variant="outline" className="h-11 w-11 rounded-lg p-0 border-muted-foreground/20">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/20 border-b-2 border-border/50">
                  <TableHead className="font-semibold py-4 pl-6 text-[10px] uppercase tracking-widest text-muted-foreground">Empresa / Contato</TableHead>
                  <TableHead className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Vínculo / Setor</TableHead>
                  <TableHead className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Comunicação</TableHead>
                  <TableHead className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Responsável Interno</TableHead>
                  <TableHead className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">Status Operacional</TableHead>
                  <TableHead className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : allContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-64 text-center text-muted-foreground italic">Nenhum registro encontrado.</TableCell></TableRow>
                ) : (
                  paginatedContacts.map((c) => (
                    <TableRow key={c.id} className="group hover:bg-muted/30 transition-all cursor-pointer border-b border-border/30" onClick={() => navigate(`/customers/${c.id}`)}>
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border shadow-sm",
                            c.cnpj ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"
                          )}>
                            {c.cnpj ? <Building2 className="w-4 h-4" /> : (c.name || "??").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm tracking-tight truncate">{c.name || "Sem Nome"}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-black truncate tracking-widest">
                              {c.cnpj ? `CNPJ: ${c.cnpj}` : 'Pessoa Física'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-tighter rounded-md bg-muted/50">
                            {c.sector || 'Geral'}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground font-medium">{c.responsibleName || 'Não informado'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                             <div className="p-1 bg-green-500/10 rounded">
                               <MessageSquare className="w-2.5 h-2.5 text-green-600" />
                             </div>
                             <p className="text-[11px] font-mono font-bold">{c.whatsapp || c.phone || '—'}</p>
                             {c.whatsapp_status && <StatusDot status={c.whatsapp_status} />}
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="p-1 bg-blue-500/10 rounded">
                               <Mail className="w-2.5 h-2.5 text-blue-600" />
                             </div>
                             <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.email || 'Sem e-mail'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {(c.internal_responsible_name || '??').substring(0, 2).toUpperCase()}
                          </div>
                          <p className="text-[11px] font-bold text-muted-foreground">{c.internal_responsible_name || 'A definir'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border-none",
                          c.operational_status === "Ativo" ? "bg-green-500/10 text-green-600" :
                          c.operational_status === "Número inválido" ? "bg-red-500/10 text-red-600" :
                          "bg-amber-500/10 text-amber-600"
                        )}>
                          {c.operational_status || 'Revisão Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Solicitar Atualização" onClick={(e) => { e.stopPropagation(); /* future logic */ }}>
                            <PhoneCall className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {allContacts.length > pageSize && (
            <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Exibindo {Math.min(allContacts.length, (currentPage - 1) * pageSize + 1)} - {Math.min(allContacts.length, currentPage * pageSize)} de {allContacts.length}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
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
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InsightCard({ label, value, icon: Icon, color, description }: any) {
  const colors: any = {
    amber: "bg-amber-500/10 text-amber-600 shadow-amber-500/5",
    red: "bg-red-500/10 text-red-600 shadow-red-500/5",
    blue: "bg-blue-500/10 text-blue-600 shadow-blue-500/5",
    primary: "bg-primary/10 text-primary shadow-primary/5",
  };

  return (
    <Card className="relative overflow-hidden border-none shadow-xl shadow-black/5 group">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2.5 rounded-2xl transition-all group-hover:scale-110 duration-300", colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
          <Badge variant="outline" className="text-[10px] font-black opacity-40">INSIGHT</Badge>
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-black tracking-tighter">{value}</p>
          <p className="text-[11px] font-bold text-foreground tracking-tight uppercase">{label}</p>
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: any = {
    "possui WhatsApp": "bg-green-500",
    "não possui WhatsApp": "bg-red-500",
    "não verificado": "bg-muted-foreground/30",
    "erro na verificação": "bg-amber-500",
  };
  return (
    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", colors[status] || "bg-muted-foreground/30")} title={status} />
  );
}
