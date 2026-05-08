import { useState, useEffect } from "react";
import { 
  Bell, 
  Settings, 
  Clock, 
  MessageSquare, 
  Calendar as CalendarIcon,
  ShieldCheck, 
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface AlertaConfig {
  id?: string;
  tenant_id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  limite_horas_sem_resposta: number;
  numero_destino: string;
  dias_semana: string[];
  horario_inicio: string;
  horario_fim: string;
  mensagem_template: string;
}

const DIAS_SEMANA = [
  { id: "1", label: "Segunda" },
  { id: "2", label: "Terça" },
  { id: "3", label: "Quarta" },
  { id: "4", label: "Quinta" },
  { id: "5", label: "Sexta" },
  { id: "6", label: "Sábado" },
  { id: "0", label: "Domingo" },
];

export default function AlertsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alerta, setAlerta] = useState<AlertaConfig>({
    tenant_id: "",
    nome: "Cliente sem resposta",
    tipo: "cliente_sem_resposta",
    ativo: false,
    limite_horas_sem_resposta: 48,
    numero_destino: "",
    dias_semana: ["1", "2", "3", "4", "5"],
    horario_inicio: "08:00",
    horario_fim: "18:00",
    mensagem_template: "⚠️ ALERTA DE ATENDIMENTO\n\nO cliente {cliente_nome} está há {horas_sem_resposta} horas sem resposta do colaborador.\n\nResponsável: {responsavel_nome}\nStatus: {status}\nAberto em: {created_at}\n\nRecomendação: verificar o atendimento e priorizar retorno."
  });

  useEffect(() => {
    if (user?.tenantId) {
      fetchAlerta();
    }
  }, [user?.tenantId]);

  const fetchAlerta = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("automacoes_alertas")
        .select("*")
        .eq("tenant_id", user?.tenantId)
        .eq("tipo", "cliente_sem_resposta")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAlerta({
          ...data,
          dias_semana: Array.isArray(data.dias_semana) ? data.dias_semana : JSON.parse(data.dias_semana || "[]")
        });
      }
    } catch (err) {
      console.error("Erro ao carregar alerta:", err);
      toast.error("Erro ao carregar configurações de alerta");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.tenantId) return;
    
    if (alerta.limite_horas_sem_resposta < 1) {
      toast.error("O limite deve ser de pelo menos 1 hora");
      return;
    }

    if (alerta.ativo && !alerta.numero_destino) {
      toast.error("Informe o número de WhatsApp para destino das notificações");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...alerta,
        tenant_id: user.tenantId,
        updated_at: new Date().toISOString()
      };

      let result;
      if (alerta.id) {
        result = await supabase
          .from("automacoes_alertas")
          .update(payload)
          .eq("id", alerta.id);
      } else {
        result = await supabase
          .from("automacoes_alertas")
          .insert([payload]);
      }

      if (result.error) throw result.error;

      toast.success("Configurações de alerta salvas com sucesso!");
      fetchAlerta();
    } catch (err) {
      console.error("Erro ao salvar alerta:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const toggleDia = (diaId: string) => {
    setAlerta(prev => {
      const dias = prev.dias_semana.includes(diaId)
        ? prev.dias_semana.filter(d => d !== diaId)
        : [...prev.dias_semana, diaId];
      return { ...prev, dias_semana: dias };
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Alertas Inteligentes</h1>
        </div>
        <p className="text-muted-foreground">
          Configure automações para monitorar o tempo de resposta e garantir a excelência no atendimento.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/10 shadow-lg shadow-primary/5 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Alerta: Cliente sem resposta
                </CardTitle>
                <CardDescription>
                  Notificar gestão quando um atendimento ficar parado por muito tempo.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-primary/10 shadow-sm">
                <Label htmlFor="alerta-ativo" className="text-xs font-bold uppercase tracking-wider cursor-pointer">
                  {alerta.ativo ? "Ativo" : "Inativo"}
                </Label>
                <Switch 
                  id="alerta-ativo" 
                  checked={alerta.ativo} 
                  onCheckedChange={(v) => setAlerta(p => ({ ...p, ativo: v }))}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Parâmetros básicos
                  </h3>
                  
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="text-sm font-medium">Nome do Alerta</Label>
                      <Input 
                        id="nome"
                        value={alerta.nome}
                        onChange={(e) => setAlerta(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Ex: Alerta Crítico - 48h"
                        className="bg-muted/30 border-primary/10"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="limite" className="text-sm font-medium">Limite sem resposta (horas)</Label>
                        <Input 
                          id="limite"
                          type="number"
                          min={1}
                          value={alerta.limite_horas_sem_resposta}
                          onChange={(e) => setAlerta(p => ({ ...p, limite_horas_sem_resposta: parseInt(e.target.value) || 1 }))}
                          className="bg-muted/30 border-primary/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp da Gestão</Label>
                        <Input 
                          id="whatsapp"
                          value={alerta.numero_destino}
                          onChange={(e) => setAlerta(p => ({ ...p, numero_destino: e.target.value }))}
                          placeholder="5511999999999"
                          className="bg-muted/30 border-primary/10"
                        />
                        <p className="text-[10px] text-muted-foreground italic">Incluir DDI + DDD (ex: 5511...)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Janela de Funcionamento
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Dias da Semana</Label>
                      <div className="flex flex-wrap gap-2">
                        {DIAS_SEMANA.map((dia) => (
                          <button
                            key={dia.id}
                            onClick={() => toggleDia(dia.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              alerta.dias_semana.includes(dia.id)
                                ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                                : "bg-muted/50 text-muted-foreground border-transparent hover:border-primary/30"
                            }`}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inicio" className="text-sm font-medium">Horário Inicial</Label>
                        <Input 
                          id="inicio"
                          type="time"
                          value={alerta.horario_inicio}
                          onChange={(e) => setAlerta(p => ({ ...p, horario_inicio: e.target.value }))}
                          className="bg-muted/30 border-primary/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fim" className="text-sm font-medium">Horário Final</Label>
                        <Input 
                          id="fim"
                          type="time"
                          value={alerta.horario_fim}
                          onChange={(e) => setAlerta(p => ({ ...p, horario_fim: e.target.value }))}
                          className="bg-muted/30 border-primary/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Template da Mensagem
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative group">
                      <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                        <MessageSquare className="w-12 h-12 text-white" />
                      </div>
                      <Textarea 
                        value={alerta.mensagem_template}
                        onChange={(e) => setAlerta(p => ({ ...p, mensagem_template: e.target.value }))}
                        className="min-h-[220px] bg-transparent border-none text-slate-100 text-sm leading-relaxed resize-none focus-visible:ring-0 p-0"
                        placeholder="Digite a mensagem do alerta..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Badge variant="outline" className="text-[10px] justify-center py-1 bg-muted/20 border-primary/5">{`{cliente_nome}`}</Badge>
                      <Badge variant="outline" className="text-[10px] justify-center py-1 bg-muted/20 border-primary/5">{`{horas_sem_resposta}`}</Badge>
                      <Badge variant="outline" className="text-[10px] justify-center py-1 bg-muted/20 border-primary/5">{`{responsavel_nome}`}</Badge>
                      <Badge variant="outline" className="text-[10px] justify-center py-1 bg-muted/20 border-primary/5">{`{status}`}</Badge>
                      <Badge variant="outline" className="text-[10px] justify-center py-1 bg-muted/20 border-primary/5 col-span-2">{`{created_at}`}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-primary/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <p className="text-[11px] font-medium italic">
                  As notificações serão enviadas via Evolution API nos horários permitidos.
                </p>
              </div>
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 px-8 py-6 rounded-2xl transition-all active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4 pt-4">
          <div className="p-6 rounded-3xl bg-emerald-50/50 border border-emerald-100 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 text-sm">Monitoramento 24h</p>
              <p className="text-[11px] text-emerald-700/70 leading-relaxed">Nossa IA monitora seus atendimentos a cada 30 minutos em busca de atrasos.</p>
            </div>
          </div>
          
          <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-blue-900 text-sm">Escala de Gestão</p>
              <p className="text-[11px] text-blue-700/70 leading-relaxed">Garanta que nenhum cliente fique sem resposta por mais tempo do que o configurado.</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-amber-50/50 border border-amber-100 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">Notificações Diretas</p>
              <p className="text-[11px] text-amber-700/70 leading-relaxed">Receba os alertas diretamente no WhatsApp configurado da gestão.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
