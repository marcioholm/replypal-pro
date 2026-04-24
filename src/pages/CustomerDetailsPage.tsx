import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, formatTime, formatRelativeTime, ensureDate } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/CustomerForm";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useCallback } from "react";
import { 
  ArrowLeft, Edit, Building, BookOpen, Users, Headphones, 
  DollarSign, FileText, History, MessageSquare, Mail, 
  Phone, Globe, MapPin, Calendar, ShieldCheck, Star,
  Cake, Handshake, Loader2
} from "lucide-react";
import ClienteDocumentos from "@/components/clientes/ClienteDocumentos";


export default function CustomerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchCustomer = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId || !id) return;

      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .single();

        if (data) {
          store.addDbCustomer({
            id: data.id,
            name: data.nome_fantasia,
            razaoSocial: data.razao_social || "",
            cnpj: data.cnpj || "",
            responsibleName: data.responsavel || "",
            whatsapp: data.whatsapp || "",
            phone: data.telefone || "",
            email: data.email || "",
            city: data.cidade || "",
            state: data.estado || "",
            regime: data.regime_tributario as any,
            naturezaJuridica: data.natureza_juridica || "",
            cnae: data.cnae || "",
            hasEmployees: !!data.has_employees,
            employeeCount: data.employee_count || 0,
            status: data.status as any,
            priority: (data.prioridade || data.priority || "Média") as any,
            serviceLevel: (data.service_level || "Padrão") as any,
            preferredChannel: (data.preferred_channel || "WhatsApp") as any,
            plan: data.plan || "",
            monthlyValue: data.monthly_value || 0,
            origin: data.origin || "Direto",
            tenantId: data.tenant_id,
            contacts: [],
            tags: [],
            documents: [],
            observations: data.observations || "",
            financialStatus: data.financial_status || "Atenção",
            createdAt: new Date(data.created_at)
          });
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Erro ao carregar detalhes do cliente:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id, user?.tenantId]);

  const customer = store.getCustomer(id);
  const conversationHistory = store.conversations.filter(c => c.customerId === id);
  const actionHistory = store.getHistory(undefined, id);

  if (loading && !customer) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <p className="text-muted-foreground text-lg">Cliente não encontrado</p>
        <Button onClick={() => navigate("/customers")}>Voltar para Lista</Button>
      </div>
    );
  }

  const statusColors = {
    "Ativo": "bg-success/20 text-success border-success/30",
    "Onboarding": "bg-info/20 text-info border-info/30",
    "Inativo": "bg-warning/20 text-warning border-warning/30",
    "Encerrado": "bg-destructive/20 text-destructive border-destructive/30",
  };

  const priorityColors = {
    "Alta": "text-destructive",
    "Média": "text-warning",
    "Baixa": "text-info",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="h-9 w-9 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{customer.name}</h1>

              <Badge variant="outline" className={statusColors[customer.status]}>
                {customer.status}
              </Badge>
              {customer.serviceLevel === 'Premium' && (
                <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-none shadow-sm">
                  <Star className="w-3 h-3 mr-1 fill-white" /> Premium
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Building className="w-3 h-3" /> {customer.razaoSocial} • {customer.cnpj}
            </p>
          </div>
        </div>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-9">
              <Edit className="w-4 h-4 mr-2" /> Editar Cadastro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Cliente: {customer.name}</DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <CustomerForm initialData={customer} onSuccess={() => setIsEditDialogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 w-full justify-start overflow-x-auto no-scrollbar h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2 py-2"><Building className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2 py-2"><Users className="w-3.5 h-3.5" /> Contatos ({customer.contacts.length})</TabsTrigger>
          <TabsTrigger value="chat" className="gap-2 py-2"><MessageSquare className="w-3.5 h-3.5" /> Atendimento ({conversationHistory.length})</TabsTrigger>
          <TabsTrigger value="docs" className="gap-2 py-2"><FileText className="w-3.5 h-3.5" /> Documentos</TabsTrigger>
          <TabsTrigger value="history" className="gap-2 py-2"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Info Contábil */}
              <Card className="hover:shadow-md transition-shadow group">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> Dados Contábeis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Regime:</span><span className="font-medium text-primary">{customer.regime}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Nat. Jurídica:</span><span className="font-medium">{customer.naturezaJuridica || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CNAE:</span><span className="font-medium">{customer.cnae || "—"}</span></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <div className="flex items-center gap-2">
                      <Cake className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Aniversário Fundação</span>
                    </div>
                    <span className="font-bold text-primary">{ensureDate(customer.openingDate)?.toLocaleDateString('pt-BR') || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Atendimento context */}
              <Card className="hover:shadow-md transition-shadow group">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-primary" /> Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Prioridade:</span><span className={`font-bold ${priorityColors[customer.priority]}`}>{customer.priority}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Nivel:</span><span className="font-medium">{customer.serviceLevel}</span></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center bg-success/5 p-2 rounded-lg border border-success/10">
                    <div className="flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-success" />
                      <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Parceria desde</span>
                    </div>
                    <span className="font-bold text-success">{ensureDate(customer.startDate)?.toLocaleDateString('pt-BR') || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Comercial */}
              <Card className="hover:shadow-md transition-shadow group">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" /> Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Plano:</span><span className="font-medium">{customer.plan}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor Mensal:</span><span className="font-bold text-success">R$ {customer.monthlyValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Financeiro:</span><Badge variant="outline" className={customer.financialStatus === 'Adimplente' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'}>{customer.financialStatus}</Badge></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Origem:</span><span className="font-medium italic">{customer.origin}</span></div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contato Principal */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Contato e Localização</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30"><span className="text-[10px] uppercase text-muted-foreground font-bold">Local</span><div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 opacity-50" /> {customer.city} - {customer.state}</div></div>
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30"><span className="text-[10px] uppercase text-muted-foreground font-bold">E-mail</span><div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 opacity-50" /> {customer.email}</div></div>
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30"><span className="text-[10px] uppercase text-muted-foreground font-bold">WhatsApp</span><div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5 opacity-50" /> {customer.whatsapp}</div></div>
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30"><span className="text-[10px] uppercase text-muted-foreground font-bold">Telefone</span><div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-50" /> {customer.phone}</div></div>
                </CardContent>
              </Card>

              {/* Observações */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Observações Internas</CardTitle></CardHeader>
                <CardContent>
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-900/50 text-sm text-amber-900 dark:text-amber-200 min-h-[100px] italic">
                    {customer.observations || "Nenhuma observação interna registrada para este cliente."}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="outline-none">
            <Card>
              <CardContent className="pt-6">
                {customer.contacts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum contato secundário cadastrado.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customer.contacts.map(c => (
                      <div key={c.id} className="p-4 border rounded-xl hover:shadow-md transition-shadow bg-card">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {c.name[0]}
                            </div>
                            <div>
                              <p className="font-bold">{c.name}</p>
                              <Badge variant="secondary" className="text-[10px] font-medium">{c.type}</Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{c.role}</p>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 opacity-50" /> {c.email}</div>
                          <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-50" /> {c.phone}</div>
                          <div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5 opacity-50" /> {c.whatsapp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="outline-none">
            <Card>
              <CardContent className="pt-6">
                {conversationHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum atendimento vinculado a este cliente ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversationHistory.map(conv => (
                      <div key={conv.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/chat/${conv.id}`)}>
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-primary/10 rounded-full text-primary">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm tracking-tight">{conv.lastMessage}</p>
                            <p className="text-[11px] text-muted-foreground">{conv.lastMessageTime.toLocaleDateString()} às {conv.lastMessageTime.toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize text-[10px]">{conv.status.replace('_', ' ')}</Badge>
                          <p className="text-xs font-medium italic opacity-60">por {conv.assignedToName || "Fila"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="outline-none">
            <ClienteDocumentos clienteId={id!} clienteNome={customer.name} />
          </TabsContent>



          <TabsContent value="history" className="outline-none">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Logs e Auditoria</CardTitle>
                <CardDescription>Rastreabilidade completa de ações realizadas neste cadastro.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative border-l-2 ml-3 py-2 space-y-6">
                  {actionHistory.map((h, i) => (
                    <div key={h.id} className="relative pl-8">
                       <span className="absolute left-[-9px] top-1.5 w-4 h-4 rounded-full bg-background border-2 border-primary ring-4 ring-background" />
                       <div className="bg-muted/40 p-4 rounded-xl border border-border/40">
                         <div className="flex justify-between items-start mb-1">
                           <p className="font-bold text-sm">{h.action}</p>
                           <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded uppercase">{formatTime(h.timestamp)}</span>
                         </div>
                         <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> {h.timestamp.toLocaleDateString('pt-BR')}</p>
                         {h.details && <p className="text-xs italic bg-background/50 p-2 rounded border border-dashed">{h.details}</p>}
                       </div>
                    </div>
                  ))}
                  {actionHistory.length === 0 && (
                    <p className="text-xs text-center text-muted-foreground py-10">Nenhum evento registrado no histórico.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
