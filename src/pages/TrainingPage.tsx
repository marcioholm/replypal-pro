import { useState, useEffect } from "react";
import { 
  Plus, Search, Filter, BrainCircuit, GraduationCap, 
  MoreHorizontal, Edit, Trash2, History, CheckCircle2, 
  XCircle, AlertTriangle, ShieldCheck, User, Calendar as CalendarIcon,
  Tag, Download, RefreshCw, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Knowledge {
  id: string;
  titulo: string;
  categoria: string;
  subcategoria: string;
  conteudo: string;
  palavras_chave: string[];
  cliente_id: string | null;
  status: 'ativo' | 'inativo' | 'pendente';
  origem: 'manual' | 'conversa' | 'importado';
  nivel_confianca: 'alta' | 'media' | 'revisar';
  data_validade: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { nome_fantasia: string };
}

import KnowledgeForm from "@/components/training/KnowledgeForm";
import KnowledgeHistory from "@/components/training/KnowledgeHistory";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TrainingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("oficial");
  
  // Estados de Gerenciamento
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<Knowledge | null>(null);
  const [historyKnowledge, setHistoryKnowledge] = useState<Knowledge | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchKnowledges = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("conhecimento_ia")
        .select(`
          *,
          cliente:cliente_id (nome_fantasia)
        `)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false });

      // Lógica de Tabs
      if (activeTab === "oficial") {
        query = query.in("status", ["ativo", "inativo"]);
      } else {
        query = query.eq("status", "pendente");
      }

      if (filterCategory !== "all") query = query.eq("categoria", filterCategory);
      if (searchQuery) query = query.ilike("titulo", `%${searchQuery}%`);

      const { data, error } = await query;
      if (error) throw error;
      setKnowledges(data || []);
    } catch (err) {
      console.error("Error fetching knowledge:", err);
      toast.error("Erro ao carregar base de conhecimento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledges();
  }, [filterCategory, searchQuery, activeTab]);

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("conhecimento_ia")
        .update({ status: 'ativo', updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast.success("Conhecimento aprovado e ativo!");
      fetchKnowledges();
    } catch (err) {
      toast.error("Erro ao aprovar conhecimento");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("conhecimento_ia")
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", deleteId);

      if (error) throw error;
      toast.success("Conhecimento removido com sucesso");
      fetchKnowledges();
    } catch (err) {
      toast.error("Erro ao remover conhecimento");
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (k: Knowledge) => {
    setEditingKnowledge(k);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditingKnowledge(null);
    setFormOpen(true);
  };

  const openHistory = (k: Knowledge) => {
    setHistoryKnowledge(k);
    setHistoryOpen(true);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ativo') return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5"><CheckCircle2 className="w-3 h-3" /> Ativo</Badge>;
    if (status === 'pendente') return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1.5"><History className="w-3 h-3" /> Pendente</Badge>;
    return <Badge variant="outline" className="text-muted-foreground gap-1.5"><XCircle className="w-3 h-3" /> Inativo</Badge>;
  };

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'alta': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20"><ShieldCheck className="w-3 h-3 mr-1" /> Alta</Badge>;
      case 'media': return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20"><AlertTriangle className="w-3 h-3 mr-1" /> MÉDIA</Badge>;
      default: return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="w-3 h-3 mr-1" /> REVISAR</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <GraduationCap className="w-6 h-6" />
             </div>
             <h1 className="text-2xl font-bold tracking-tight">Treinamento da IA</h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Cadastre orientações, procedimentos e regras para a IA responder sua equipe com base no padrão do escritório.
          </p>
        </div>
        <Button className="gap-2 shadow-lg shadow-primary/20" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo Conhecimento
        </Button>
      </div>

      <KnowledgeForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        editData={editingKnowledge} 
        onSuccess={fetchKnowledges}
      />

      <KnowledgeHistory 
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        knowledgeId={historyKnowledge?.id || null}
        knowledgeTitle={historyKnowledge?.titulo || null}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Conhecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação desativará permanentemente este conhecimento para a IA. Você poderá consultar o histórico de auditoria se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
               Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats e Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total cadastrado", value: knowledges.length, icon: Layers, color: "text-blue-600" },
          { label: "Ativos na IA", value: knowledges.filter(k => k.status === 'ativo').length, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Nível Confiança Alta", value: knowledges.filter(k => k.nivel_confianca === 'alta').length, icon: ShieldCheck, color: "text-primary" },
          { label: "Precisam de Revisão", value: knowledges.filter(k => k.nivel_confianca === 'revisar').length, icon: AlertTriangle, color: "text-orange-600" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-muted/30">
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 opacity-10 ${stat.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Abas de Navegação e Filtros */}
      <Tabs defaultValue="oficial" className="space-y-6" onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <TabsList className="bg-muted/40 p-1">
            <TabsTrigger value="oficial" className="gap-2 px-6">
               <ShieldCheck className="w-4 h-4" /> Base Oficial
            </TabsTrigger>
            <TabsTrigger value="sugestoes" className="gap-2 px-6">
               <Sparkles className="w-4 h-4" /> Sugestões da IA
               {knowledges.length > 0 && activeTab === "sugestoes" && (
                 <Badge className="ml-1 h-5 px-1.5 bg-primary text-white border-none">{knowledges.length}</Badge>
               )}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
              <Input 
                placeholder="Pesquisar..." 
                className="pl-9 bg-muted/20 border-none h-10 w-full" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] h-10 bg-muted/20 border-none">
                <Tag className="w-3.5 h-3.5 mr-2 opacity-50" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {["Trabalhista / RH", "Fiscal", "Contábil", "Financeiro", "Atendimento"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="oficial" className="border-none p-0 m-0">
           {renderKnowledgeTable()}
        </TabsContent>
        
        <TabsContent value="sugestoes" className="border-none p-0 m-0">
           {renderKnowledgeTable()}
        </TabsContent>
      </Tabs>
    </div>
  );

  function renderKnowledgeTable() {
    return (
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-[10px] uppercase">Título do Conhecimento</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Categoria</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Origem</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Confiança</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Cliente Associado</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Atualizado em</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20 opacity-50 italic">
                   <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      Consultando base de conhecimento...
                   </div>
                </TableCell>
              </TableRow>
            ) : knowledges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-32 text-muted-foreground italic">
                   Nenhum item encontrado nesta categoria.
                </TableCell>
              </TableRow>
            ) : (
              knowledges.map((k) => (
                <TableRow key={k.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors">{k.titulo}</span>
                      <span className="text-[10px] text-muted-foreground/60 italic">{k.subcategoria || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-medium py-0 h-5 border-muted-foreground/20">{k.categoria}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-[11px] opacity-70">
                      {k.origem === 'manual' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3 text-primary/60" />}
                      <span className="capitalize">{k.origem}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getConfidenceBadge(k.nivel_confianca)}</TableCell>
                  <TableCell>
                    {k.cliente ? (
                       <Badge className="bg-primary/5 text-primary text-[10px] border-primary/10">{k.cliente.nome_fantasia}</Badge>
                    ) : (
                       <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-40">Todos Clientes</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-[10px] opacity-70">
                      <span className="font-mono">{format(new Date(k.updated_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(k.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {activeTab === "sugestoes" && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 px-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                          onClick={() => handleApprove(k.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(k)}>
                            <Edit className="w-4 h-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openHistory(k)}>
                            <History className="w-4 h-4" /> Histórico de Versões
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(k.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Excluir permanentemente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }
}
