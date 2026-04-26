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
  status: 'ativo' | 'inativo';
  origem: 'manual' | 'conversa' | 'importado';
  nivel_confianca: 'alta' | 'media' | 'revisar';
  data_validade: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { name: string };
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

export default function TrainingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
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
          cliente:cliente_id (name)
        `)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false });

      if (filterCategory !== "all") query = query.eq("categoria", filterCategory);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
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
  }, [filterCategory, filterStatus, searchQuery]);

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

      {/* Filtros */}
      <Card className="border-none shadow-sm pb-2">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
              <Input 
                placeholder="Buscar por título, categoria ou palavra-chave..." 
                className="pl-9 bg-muted/20 border-none h-10" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] h-10 bg-muted/20 border-none">
                  <Tag className="w-3.5 h-3.5 mr-2 opacity-50" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  <SelectItem value="Trabalhista / RH">Trabalhista / RH</SelectItem>
                  <SelectItem value="Fiscal">Fiscal</SelectItem>
                  <SelectItem value="Contábil">Contábil</SelectItem>
                  <SelectItem value="Financeiro">Financeiro</SelectItem>
                  <SelectItem value="Procedimentos internos">Procedimentos internos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-10 bg-muted/20 border-none">
                  <Filter className="w-3.5 h-3.5 mr-2 opacity-50" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => fetchKnowledges()} title="Atualizar">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem */}
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
                   Nenhum conhecimento cadastrado com estes filtros.
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
                      {k.origem === 'manual' ? <User className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                      <span className="capitalize">{k.origem}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getConfidenceBadge(k.nivel_confianca)}</TableCell>
                  <TableCell>
                    {k.cliente ? (
                       <Badge className="bg-primary/5 text-primary text-[10px] border-primary/10">{k.cliente.name}</Badge>
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
