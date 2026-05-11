import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger 
} from "@/components/ui/tooltip";
import { initializeDatabase } from '@/lib/dbSetup';
import { 
  FileText, Plus, Trash2, Send, CheckCircle2, Clock, 
  Settings2, Users, AlertCircle, MessageSquare, Globe, 
  Loader2, ChevronLeft, Database, Search, Filter, 
  BarChart3, Activity, XCircle, AlertTriangle, ArrowRight, RefreshCcw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DestinationNumber {
  nome: string;
  numero: string;
  ativo: boolean;
}

interface ReportLog {
  id: string;
  numero_destino: string;
  nome_destinatario: string;
  status: 'enviado' | 'erro' | 'pendente';
  enviado_em: string;
  erro?: string;
  tipo: string;
}

const N8N_RELATORIO_TESTE_WEBHOOK_URL = "https://northway.vps8204.panel.icontainer.cloud/webhook/replypal/relatorio-atendimento/teste";

export default function DailyReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Estados de Configuração
  const [id, setId] = useState<string | null>(null);
  const [nome, setNome] = useState("Relatório Diário de Atendimento");
  const [ativo, setAtivo] = useState(true);
  const [horario, setHorario] = useState("08:00");
  const [timezone] = useState("America/Sao_Paulo");
  const [mensagemIntro, setMensagemIntro] = useState("📊 Relatório diário de atendimento");
  
  const [incluirResumoGeral, setIncluirResumoGeral] = useState(true);
  const [incluirPorUsuario, setIncluirPorUsuario] = useState(true);
  const [incluirPendentes, setIncluirPendentes] = useState(true);
  const [incluirTempoResposta, setIncluirTempoResposta] = useState(true);
  const [incluirAlertas, setIncluirAlertas] = useState(true);
  
  const [numerosDestino, setNumerosDestino] = useState<DestinationNumber[]>([
    { nome: "Gestão", numero: "", ativo: true }
  ]);

  // Estados de Histórico
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [user]);

  const fetchConfig = async () => {
    if (!user?.tenantId) return;
    try {
      const { data, error } = await supabase
        .from("automacoes_relatorios")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .eq("tipo", "resumo_diario_atendimento")
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setId(data.id);
        setNome(data.nome);
        setAtivo(data.ativo);
        setHorario(data.horario.substring(0, 5));
        setMensagemIntro(data.mensagem_intro || "");
        setIncluirResumoGeral(data.incluir_resumo_geral);
        setIncluirPorUsuario(data.incluir_por_usuario);
        setIncluirPendentes(data.incluir_pendentes);
        setIncluirTempoResposta(data.incluir_tempo_resposta);
        setIncluirAlertas(data.incluir_alertas);
        if (data.numeros_destino && Array.isArray(data.numeros_destino)) {
          setNumerosDestino(data.numeros_destino);
        }
      }
    } catch (err) {
      console.error("Erro config:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!user?.tenantId) return;
    try {
      const { data, error } = await supabase
        .from("relatorios_envios_logs")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .order("enviado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Erro logs:", err);
    }
  };

  // Métricas Calculadas
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.enviado_em.startsWith(today));
    const sentToday = todayLogs.filter(l => l.status === 'enviado').length;
    const errorsToday = todayLogs.filter(l => l.status === 'erro').length;
    const successRate = todayLogs.length > 0 
      ? Math.round((sentToday / todayLogs.length) * 100) 
      : 100;
    const lastSend = logs.length > 0 ? logs[0].enviado_em : null;

    return { sentToday, errorsToday, successRate, lastSend };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.nome_destinatario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.numero_destino.includes(searchTerm);
      const matchesStatus = statusFilter === "todos" || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  const handleSave = async () => {
    if (!user?.tenantId) return;
    
    const activeNumbers = numerosDestino.filter(n => n.ativo);
    const validNumbers = activeNumbers.filter(n => n.numero.replace(/\D/g, "").length >= 10);

    if (ativo) {
      if (activeNumbers.length === 0) {
        toast.error("Ative pelo menos um número para receber o relatório.");
        return;
      }
      if (validNumbers.length === 0) {
        toast.error("O número deve ter pelo menos 10 dígitos (DDD + Número).");
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Verificar se já existe uma configuração
      const { data: existing } = await supabase
        .from("automacoes_relatorios")
        .select("id")
        .eq("tenant_id", user.tenantId)
        .eq("tipo", "resumo_diario_atendimento")
        .maybeSingle();

      const payload = {
        tenant_id: user.tenantId,
        tipo: "resumo_diario_atendimento",
        nome,
        ativo,
        horario: horario + ":00",
        timezone,
        mensagem_intro: mensagemIntro,
        incluir_resumo_geral: incluirResumoGeral,
        incluir_por_usuario: incluirPorUsuario,
        incluir_pendentes: incluirPendentes,
        incluir_tempo_resposta: incluirTempoResposta,
        incluir_alertas: incluirAlertas,
        numeros_destino: numerosDestino.map(n => ({ ...n, numero: n.numero.replace(/\D/g, "") })),
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing?.id) {
        // Atualizar
        result = await supabase
          .from("automacoes_relatorios")
          .update(payload)
          .eq("id", existing.id);
      } else {
        // Inserir novo
        result = await supabase
          .from("automacoes_relatorios")
          .insert(payload);
      }

      if (result.error) throw result.error;
      toast.success("Configurações salvas!");
      fetchConfig();
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!N8N_RELATORIO_TESTE_WEBHOOK_URL) {
      toast.info("Webhook de teste não configurado.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(N8N_RELATORIO_TESTE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: user?.tenantId, modo: "teste" })
      });
      if (res.ok) toast.success("Teste disparado!");
      else throw new Error();
    } catch {
      toast.error("Falha ao disparar teste.");
    } finally {
      setTesting(false);
    }
  };

  const handleRepairDB = async () => {
    setLoading(true);
    try {
      const result = await initializeDatabase();
      if (result.success) {
        toast.success("Banco de dados reparado com sucesso!", {
          description: "As colunas e tabelas foram sincronizadas."
        });
        fetchConfig();
      } else {
        throw result.error;
      }
    } catch (err: any) {
      console.error("Erro ao reparar banco:", err);
      toast.error("Erro ao reparar banco de dados", {
        description: err.message || "A função 'exec_sql' pode estar ausente no seu Supabase."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl py-8 space-y-10 animate-in fade-in duration-700">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground/60 text-[10px] font-bold uppercase tracking-[0.2em]">
            <Settings2 className="w-3 h-3" />
            Configurações
            <ArrowRight className="w-2 h-2" />
            Relatórios
          </div>
          <h1 className="text-4xl font-black tracking-tight italic uppercase">
            Daily <span className="text-primary not-italic">Report</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Painel executivo para gestão de disparos automáticos de métricas via WhatsApp.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleRepairDB} 
            className="rounded-xl border-amber-500/20 text-amber-600 hover:bg-amber-500/5 font-bold uppercase tracking-widest text-[10px]"
          >
            <Database className="w-3 h-3 mr-2" />
            Reparar Banco
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTest} 
            disabled={testing || !id}
            className="rounded-xl border-border/40 hover:bg-primary/5 text-xs font-bold uppercase tracking-wider h-11 px-6 transition-all active:scale-95"
          >
            {testing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
            Disparar Teste
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 text-xs font-bold uppercase tracking-wider h-11 px-8 transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Enviados Hoje", value: metrics.sentToday, icon: CheckCircle2, color: "text-green-500" },
          { label: "Falhas Hoje", value: metrics.errorsToday, icon: XCircle, color: "text-red-500" },
          { label: "Taxa de Sucesso", value: `${metrics.successRate}%`, icon: Activity, color: "text-blue-500" },
          { label: "Último Envio", value: metrics.lastSend ? format(new Date(metrics.lastSend), "HH:mm", { locale: ptBR }) : "--:--", icon: Clock, color: "text-primary" },
        ].map((kpi, i) => (
          <Card key={i} className="rounded-2xl border-border/40 bg-card/30 backdrop-blur-md shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl bg-background border border-border/40 flex items-center justify-center", kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{kpi.label}</p>
                <p className="text-xl font-black tabular-nums">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Esquerdo: Configurações Core */}
        <div className="lg:col-span-5 space-y-8">
          {/* Card 1: Status e Agendamento */}
          <Card className="rounded-[28px] border-border/40 shadow-xl shadow-black/5 overflow-hidden bg-card/40 backdrop-blur-xl">
            <div className="p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold tracking-tight italic uppercase">Status do Serviço</h3>
                  <p className="text-xs text-muted-foreground">Controle a ativação e o horário de disparo.</p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                  ativo ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", ativo ? "bg-green-500" : "bg-red-500")} />
                  {ativo ? "Ativo" : "Inativo"}
                </div>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl bg-background/50 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Relatório Automático</Label>
                  <p className="text-[10px] text-muted-foreground">Habilita o envio recorrente</p>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} className="data-[state=checked]:bg-primary" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Horário Local</Label>
                  <Input 
                    type="time" 
                    value={horario} 
                    onChange={(e) => setHorario(e.target.value)}
                    className="h-12 rounded-xl bg-background/50 border-border/40 font-bold text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Timezone</Label>
                  <div className="h-12 flex items-center px-4 rounded-xl bg-muted/30 border border-border/40 text-[10px] font-bold italic">
                    America/Sao_Paulo
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Conteúdo do Relatório */}
          <Card className="rounded-[28px] border-border/40 shadow-xl shadow-black/5 overflow-hidden bg-card/40 backdrop-blur-xl">
            <div className="p-8 space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold tracking-tight italic uppercase">Composição dos Dados</h3>
                <p className="text-xs text-muted-foreground">Selecione os módulos que compõem o resumo.</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: "geral", label: "Resumo Geral", state: incluirResumoGeral, setState: setIncluirResumoGeral },
                  { id: "usuario", label: "Desempenho por Usuário", state: incluirPorUsuario, setState: setIncluirPorUsuario },
                  { id: "pendentes", label: "Listagem de Pendências", state: incluirPendentes, setState: setIncluirPendentes },
                  { id: "tempo", label: "Tempo de Resposta (SLA)", state: incluirTempoResposta, setState: setIncluirTempoResposta },
                  { id: "alertas", label: "Incidentes e Alertas", state: incluirAlertas, setState: setIncluirAlertas },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-border/40 hover:bg-background/40 transition-all cursor-pointer group" onClick={() => item.setState(!item.state)}>
                    <Label className="text-xs font-bold group-hover:text-primary transition-colors cursor-pointer">{item.label}</Label>
                    <Checkbox checked={item.state} onCheckedChange={(v) => item.setState(v as boolean)} className="rounded-md data-[state=checked]:bg-primary" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Lado Direito: Destinatários e Logs */}
        <div className="lg:col-span-7 space-y-8">
          {/* Card 3: Destinatários */}
          <Card className="rounded-[28px] border-border/40 shadow-xl shadow-black/5 overflow-hidden bg-card/40 backdrop-blur-xl">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold tracking-tight italic uppercase">Equipe de Gestão</h3>
                  <p className="text-xs text-muted-foreground">Números que receberão o relatório via WhatsApp.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setNumerosDestino([...numerosDestino, { nome: "", numero: "", ativo: true }])} className="rounded-xl border-primary/30 text-primary h-8 font-black uppercase tracking-tighter text-[10px]">
                  + Adicionar
                </Button>
              </div>

              <div className="space-y-4">
                {numerosDestino.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-2xl bg-background/40 border border-border/40 animate-in slide-in-from-right-4 duration-300">
                    <div className="md:col-span-5 space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">Nome</Label>
                      <Input value={item.nome} onChange={(e) => {
                        const newNums = [...numerosDestino];
                        newNums[index].nome = e.target.value;
                        setNumerosDestino(newNums);
                      }} className="h-10 rounded-xl bg-background/50 border-border/40" />
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">WhatsApp</Label>
                      <Input value={item.numero} onChange={(e) => {
                        const newNums = [...numerosDestino];
                        newNums[index].numero = e.target.value;
                        setNumerosDestino(newNums);
                      }} className="h-10 rounded-xl bg-background/50 border-border/40" />
                    </div>
                    <div className="md:col-span-3 flex items-end justify-end gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <Label className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/60">Ativo</Label>
                        <Switch 
                          checked={item.ativo}
                          onCheckedChange={(val) => {
                            const newNums = [...numerosDestino];
                            newNums[index].ativo = val;
                            setNumerosDestino(newNums);
                          }}
                          className="data-[state=checked]:bg-green-500 scale-90"
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => {
                        const newNums = [...numerosDestino];
                        newNums.splice(index, 1);
                        setNumerosDestino(newNums);
                      }} className="rounded-xl text-red-400 hover:bg-red-500/10 transition-all h-10 w-10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Card 4: Histórico (Logs) */}
          <Card className="rounded-[28px] border-border/40 shadow-xl shadow-black/5 overflow-hidden bg-card/40 backdrop-blur-xl">
            <div className="p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold tracking-tight italic uppercase">Histórico de Disparos</h3>
                  <p className="text-xs text-muted-foreground">Acompanhe as últimas tentativas de envio.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 w-[180px] rounded-xl bg-background/50 border-border/40 text-xs"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={fetchLogs} className="rounded-xl h-9 w-9">
                    <RefreshCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/40 overflow-hidden bg-background/20">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[10px] font-black uppercase py-4">Status</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Destinatário</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Data/Hora</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="border-border/40 hover:bg-white/5 transition-colors">
                        <TableCell className="py-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  {log.status === 'enviado' ? (
                                    <div className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[9px] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> ENVIADO
                                    </div>
                                  ) : log.status === 'erro' ? (
                                    <div className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-[9px] font-bold flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> ERRO
                                    </div>
                                  ) : (
                                    <div className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-bold flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> PENDENTE
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              {log.erro && (
                                <TooltipContent className="bg-destructive text-destructive-foreground p-3 rounded-xl max-w-[200px]">
                                  <p className="text-xs font-bold mb-1">Motivo da Falha:</p>
                                  <p className="text-[10px] leading-relaxed opacity-90">{log.erro}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{log.nome_destinatario || 'Sem Nome'}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{log.numero_destino}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold">{format(new Date(log.enviado_em), "dd MMM", { locale: ptBR })}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(log.enviado_em), "HH:mm")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/10 hover:text-primary">
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center text-muted-foreground/40 text-[10px] font-bold italic">
                          Nenhum log encontrado para os critérios selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
