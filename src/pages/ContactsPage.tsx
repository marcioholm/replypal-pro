import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ContactImportDialog } from "@/components/clientes/ContactImportDialog";
import { SimpleContactDialog } from "@/components/clientes/SimpleContactDialog";
import { SmartHygieneDialog } from "@/components/clientes/SmartHygieneDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import { 
  Users, UserPlus, Search, Filter, 
  MessageSquare, ChevronRight, Briefcase, FilterX,
  Loader2, UserCheck, ChevronLeft
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
              name: c.nome_fantasia || "Sem Nome",
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

  const individualContacts = store.customers
    .filter(c => !c.cnpj || c.cnpj.trim().length === 0)
    .filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.whatsapp.includes(search)
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalPages = Math.ceil(individualContacts.length / pageSize);
  const paginatedContacts = individualContacts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when search changes
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestão de Contatos</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              Contatos avulsos e prospectos
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <SmartHygieneDialog />
          <SimpleContactDialog onSuccess={() => {}} />
          <ContactImportDialog onSuccess={() => window.location.reload()} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-none shadow-xl shadow-primary/5 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">{individualContacts.length}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Contatos individuais</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
        <CardHeader className="bg-muted/20 pb-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou telefone..." 
              className="pl-9 bg-background border-muted-foreground/20 focus-visible:ring-primary h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/20 border-b-2 border-border/50">
                  <TableHead className="w-[280px] font-semibold py-4 pl-6 text-xs uppercase tracking-wider text-muted-foreground">Contato</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">WhatsApp / Identificação</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Tipo</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : paginatedContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-64 text-center text-muted-foreground italic">Nenhum contato avulso encontrado.</TableCell></TableRow>
                ) : (
                  paginatedContacts.map((c) => (
                    <TableRow key={c.id} className="group hover:bg-muted/30 transition-all cursor-pointer border-b border-border/30" onClick={() => navigate(`/customers/${c.id}`)}>
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs border shadow-sm">
                            {(c.name || "??").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm tracking-tight truncate">{c.name || "Sem Nome"}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium truncate">{c.email || 'Sem e-mail'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <div className="p-1.5 bg-green-500/10 rounded-lg">
                             <MessageSquare className="w-3 h-3 text-green-500" />
                           </div>
                           <p className="text-xs font-mono font-medium">{c.whatsapp || c.phone || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          Avulso
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                         <ChevronRight className="w-4 h-4 text-primary ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {individualContacts.length > pageSize && (
            <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Exibindo {Math.min(individualContacts.length, (currentPage - 1) * pageSize + 1)} - {Math.min(individualContacts.length, currentPage * pageSize)} de {individualContacts.length}
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
