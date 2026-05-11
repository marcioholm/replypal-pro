import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  Clock, 
  Settings2, 
  Users, 
  AlertCircle,
  MessageSquare,
  Globe,
  Loader2,
  ChevronLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DestinationNumber {
  nome: string;
  numero: string;
  ativo: boolean;
}

const N8N_RELATORIO_TESTE_WEBHOOK_URL = ""; // Preencher futuramente

export default function DailyReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [id, setId] = useState<string | null>(null);
  const [nome, setNome] = useState("Relatório Diário de Atendimento");
  const [ativo, setAtivo] = useState(true);
  const [horario, setHorario] = useState("08:00");
  const [timezone] = useState("America/Sao_Paulo");
  const [mensagemIntro, setMensagemIntro] = useState("Olá, aqui está o resumo diário de atendimentos da sua empresa.");
  
  const [incluirResumoGeral, setIncluirResumoGeral] = useState(true);
  const [incluirPorUsuario, setIncluirPorUsuario] = useState(true);
  const [incluirPendentes, setIncluirPendentes] = useState(true);
  const [incluirTempoResposta, setIncluirTempoResposta] = useState(true);
  const [incluirAlertas, setIncluirAlertas] = useState(true);
  
  const [numerosDestino, setNumerosDestino] = useState<DestinationNumber[]>([
    { nome: "", numero: "", ativo: true }
  ]);

  useEffect(() => {
    fetchConfig();
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
        setHorario(data.horario.substring(0, 5)); // HH:mm
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
      console.error("Erro ao buscar config:", err);
      toast.error("Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  };

  const sanitizeNumber = (num: string) => {
    const cleaned = num.replace(/\D/g, "");
    if (!cleaned.startsWith("55") && cleaned.length >= 10) {
      return "55" + cleaned;
    }
    return cleaned;
  };

  const handleAddNumber = () => {
    setNumerosDestino([...numerosDestino, { nome: "", numero: "", ativo: true }]);
  };

  const handleRemoveNumber = (index: number) => {
    if (numerosDestino.length === 1) {
      toast.warning("É necessário pelo menos um número configurado.");
      return;
    }
    const newNumbers = [...numerosDestino];
    newNumbers.splice(index, 1);
    setNumerosDestino(newNumbers);
  };

  const handleUpdateNumber = (index: number, field: keyof DestinationNumber, value: any) => {
    const newNumbers = [...numerosDestino];
    newNumbers[index] = { ...newNumbers[index], [field]: value };
    setNumerosDestino(newNumbers);
  };

  const handleSave = async () => {
    if (!user?.tenantId) return;

    const activeNumbers = numerosDestino.filter(n => n.ativo && n.numero.length >= 8);
    if (ativo && activeNumbers.length === 0) {
      toast.error("Para ativar o relatório, adicione pelo menos um número ativo.");
      return;
    }

    setSaving(true);
    try {
      const sanitizedNumbers = numerosDestino.map(n => ({
        ...n,
        numero: sanitizeNumber(n.numero)
      }));

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
        numeros_destino: sanitizedNumbers,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("automacoes_relatorios")
        .upsert(payload, { onConflict: 'tenant_id,tipo' });

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
      fetchConfig();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!N8N_RELATORIO_TESTE_WEBHOOK_URL) {
      toast.info("Webhook de teste não configurado ainda.", {
        description: "Aguardando URL do fluxo no N8N."
      });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch(N8N_RELATORIO_TESTE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: user?.tenantId,
          tipo: "resumo_diario_atendimento",
          modo: "teste"
        })
      });

      if (response.ok) {
        toast.success("Teste enviado com sucesso!");
      } else {
        throw new Error("Erro na resposta do webhook");
      }
    } catch (err) {
      console.error("Erro ao testar:", err);
      toast.error("Erro ao enviar teste.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="p-0 h-auto hover:bg-transparent text-xs font-bold uppercase tracking-widest gap-1">
              <ChevronLeft className="w-3 h-3" />
              Configurações
            </Button>
            <span className="text-[10px] opacity-30">/</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Relatórios</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase text-foreground">
            Relatório Diário <span className="text-primary text-2xl not-italic">●</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Configure o envio automático do resumo de atendimentos via WhatsApp para a sua equipe de gestão.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleTest} 
            disabled={testing || !id}
            className="rounded-xl border-primary/20 hover:bg-primary/5 text-primary transition-all font-bold uppercase tracking-widest text-[10px]"
          >
            {testing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
            Enviar teste agora
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all font-bold uppercase tracking-widest text-[10px] px-6"
          >
            {saving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-2" />}
            Salvar Configuração
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Esquerdo: Status e Conteúdo */}
        <div className="lg:col-span-4 space-y-8">
          {/* Card 1: Status */}
          <Card className="rounded-[22px] border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm transition-all hover:border-primary/20">
            <CardHeader className="border-b border-border/40 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-tight">Status do Relatório</CardTitle>
                  <CardDescription className="text-[10px]">Agendamento e fuso horário</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50 transition-all hover:bg-background">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Relatório Ativado</Label>
                  <p className="text-[10px] text-muted-foreground">Envio automático habilitado</p>
                </div>
                <Switch 
                  checked={ativo} 
                  onCheckedChange={setAtivo}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Horário de Envio</Label>
                  <div className="relative group">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="time" 
                      value={horario} 
                      onChange={(e) => setHorario(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-background border-border/40 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fuso Horário</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      value="America/Sao_Paulo (Brasil)" 
                      disabled 
                      className="pl-10 h-11 rounded-xl bg-muted/50 border-border/20 italic text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Conteúdo */}
          <Card className="rounded-[22px] border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm transition-all hover:border-primary/20">
            <CardHeader className="border-b border-border/40 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-tight">Conteúdo</CardTitle>
                  <CardDescription className="text-[10px]">O que será incluído no PDF/Mensagem</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {[
                { id: "geral", label: "Resumo Geral", desc: "Total de atendimentos, novos e resolvidos", state: incluirResumoGeral, setState: setIncluirResumoGeral },
                { id: "usuario", label: "Desempenho por Usuário", desc: "Métricas individuais de cada atendente", state: incluirPorUsuario, setState: setIncluirPorUsuario },
                { id: "pendentes", label: "Pendências Atuais", desc: "Listagem de conversas aguardando resposta", state: incluirPendentes, setState: setIncluirPendentes },
                { id: "tempo", label: "Tempo Médio de Resposta", desc: "Performance de agilidade da equipe", state: incluirTempoResposta, setState: setIncluirTempoResposta },
                { id: "alertas", label: "Alertas Inteligentes", desc: "Incidentes e SLAs estourados no dia", state: incluirAlertas, setState: setIncluirAlertas },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-border/40 hover:bg-background/50 transition-all group">
                  <Checkbox 
                    id={item.id} 
                    checked={item.state} 
                    onCheckedChange={(checked) => item.setState(checked as boolean)}
                    className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={item.id}
                      className="text-xs font-bold leading-none cursor-pointer group-hover:text-primary transition-colors"
                    >
                      {item.label}
                    </label>
                    <p className="text-[10px] text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Lado Direito: Números e Mensagem */}
        <div className="lg:col-span-8 space-y-8">
          {/* Card 3: Números da Gestão */}
          <Card className="rounded-[22px] border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm transition-all hover:border-primary/20">
            <CardHeader className="border-b border-border/40 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold uppercase tracking-tight">Números da Gestão</CardTitle>
                    <CardDescription className="text-[10px]">Destinatários que receberão o relatório</CardDescription>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddNumber}
                  className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 h-8 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {numerosDestino.map((item, index) => (
                  <div 
                    key={index} 
                    className={cn(
                      "flex flex-col md:flex-row items-end md:items-center gap-4 p-4 rounded-[18px] border transition-all animate-in zoom-in-95 duration-300",
                      item.ativo ? "border-border/40 bg-background/30" : "border-dashed border-border/40 opacity-60 bg-muted/10"
                    )}
                  >
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Nome</Label>
                        <Input 
                          placeholder="Ex: Direção" 
                          value={item.nome}
                          onChange={(e) => handleUpdateNumber(index, 'nome', e.target.value)}
                          className="h-10 rounded-xl bg-background/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">WhatsApp</Label>
                        <Input 
                          placeholder="5542999999999" 
                          value={item.numero}
                          onChange={(e) => handleUpdateNumber(index, 'numero', e.target.value)}
                          className="h-10 rounded-xl bg-background/50"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 md:pt-0">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Ativo</span>
                        <Switch 
                          checked={item.ativo}
                          onCheckedChange={(val) => handleUpdateNumber(index, 'ativo', val)}
                          className="scale-75 data-[state=checked]:bg-primary"
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveNumber(index)}
                        className="rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {numerosDestino.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/40 rounded-[22px] bg-muted/10">
                    <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-bold text-muted-foreground/50">Nenhum número cadastrado</p>
                    <Button variant="ghost" size="sm" onClick={handleAddNumber} className="mt-2 text-primary hover:bg-primary/5">
                      Adicionar o primeiro número
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Mensagem Inicial */}
          <Card className="rounded-[22px] border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm transition-all hover:border-primary/20">
            <CardHeader className="border-b border-border/40 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-tight">Mensagem de Introdução</CardTitle>
                  <CardDescription className="text-[10px]">Texto que antecede os dados do relatório</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Textarea 
                  placeholder="Olá! Aqui estão as métricas de hoje..." 
                  value={mensagemIntro}
                  onChange={(e) => setMensagemIntro(e.target.value)}
                  className="min-h-[120px] rounded-2xl bg-background/50 border-border/40 focus:ring-primary/20 resize-none p-4 text-sm"
                />
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-medium text-primary/80">
                    Dica: Use uma saudação amigável. O relatório detalhado será anexado logo abaixo desta mensagem.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
