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
  AlertCircle,
  AlertTriangle,
  Lock,
  FileText,
  Check,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
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
import { CertificadoAprovacaoModal } from "@/components/arquivos/CertificadoAprovacaoModal";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PillToggle, InitialsAvatar } from "@/components/conta-ui";
import { useStore, formatRelativeTime, type Conversation } from "@/lib/store";

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

// Map database row to Conversation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConv(c: any): Conversation {
  return {
    id: c.id,
    clientName: c.client_name || "Cliente",
    clientPhone: c.client_phone || "",
    customerId: c.customer_id,
    lastMessage: c.last_message || "",
    lastMessageTime: new Date(c.last_message_time || Date.now()),
    status: c.status || "novo",
    assignedTo: c.assigned_to,
    startedAt: c.started_at ? new Date(c.started_at) : undefined,
    slaDeadline: c.sla_deadline ? new Date(c.sla_deadline) : undefined,
    tenantId: c.tenant_id,
    tags: c.tags || [],
    clientAvatar: c.client_avatar,
    isGroup: c.is_group,
    protocolo: c.protocolo,
    resolvedAt: c.resolved_at,
  };
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
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<Conversation[]>([]);
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

  const [solicitacoesAcesso, setSolicitacoesAcesso] = useState<any[]>([]);
  const [pedidosCertificado, setPedidosCertificado] = useState<any[]>([]);
  const [aprovandoPedidoCertificado, setAprovandoPedidoCertificado] = useState<any | null>(null);

  const fetchPendenciasAprovacao = async () => {
    if (!user?.tenantId) return;
    try {
      // 1. Solicitações de acesso pendentes (para admin e supervisor)
      if (["admin", "supervisor"].includes(user.role || "")) {
        const { data: solData } = await supabase
          .from("solicitacoes_acesso")
          .select("*, usuarios!solicitante_id(nome), clientes!cliente_id(nome_fantasia)")
          .eq("tenant_id", user.tenantId)
          .eq("status", "pendente")
          .order("created_at", { ascending: false });

        setSolicitacoesAcesso(solData || []);
      }

      // 2. Pedidos de certificado digital aguardando admin (apenas admin)
      if (user.role === "admin") {
        const { data: certData } = await supabase
          .from("vw_pedidos_documento_pendentes")
          .select("*")
          .eq("tenant_id", user.tenantId)
          .eq("status", "aguardando_admin")
          .eq("tipo", "certificado_digital")
          .order("created_at", { ascending: false });

        setPedidosCertificado(certData || []);
      }
    } catch (e) {
      console.error("Erro ao buscar pendencias de aprovação:", e);
    }
  };

  useEffect(() => {
    if (user?.tenantId) {
      fetchAlerta();
      fetchPendenciasAprovacao();
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

      // Buscar conversas abertas para os Alertas Ativos
      const { data: convsData } = await supabase
        .from("conversas")
        .select("id, client_name, client_phone, customer_id, last_message, last_message_time, status, assigned_to, started_at, sla_deadline, tenant_id, tags, client_avatar, is_group, protocolo, resolved_at")
        .eq("tenant_id", user?.tenantId)
        .neq("status", "resolvido");

      if (convsData) {
         const convs = convsData.map(mapConv).filter(c => !c.isGroup);
         // Filtrar estourados
         const estourados = convs.filter(c => store.getSLAStatus(c) === "estourado");
         // Ordenar do mais antigo para o mais recente (os que estão estourados há mais tempo)
         estourados.sort((a, b) => a.lastMessageTime.getTime() - b.lastMessageTime.getTime());
         setActiveAlerts(estourados);
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
    <div className="flex flex-col gap-5 px-8 pb-8 pt-5">
      <div className="grid gap-6">
        {/* 1. Pedidos de Certificado Digital Aguardando Aprovação (só admin) */}
        {user?.role === "admin" && pedidosCertificado.length > 0 && (
          <Card className="rounded-xl border-2 border-destructive/40 bg-destructive/5 overflow-hidden">
            <CardHeader className="pb-3 border-b border-destructive/20 bg-destructive/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-destructive">
                  <ShieldCheck className="w-5 h-5" />
                  Aprovação de Certificado Digital ({pedidosCertificado.length})
                </CardTitle>
                <Badge variant="destructive" className="font-mono text-xs">Ação Crítica</Badge>
              </div>
              <CardDescription className="text-xs text-destructive/80">
                O envio do certificado digital exige digitação do nome da empresa pelo administrador. Nunca envie a senha.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-destructive/15">
              {pedidosCertificado.map((ped) => (
                <div key={ped.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-foreground">{ped.empresa}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitante: <span className="font-semibold text-foreground">{ped.contato_nome || "Contato"}</span> {ped.contato_papel ? `(${ped.contato_papel})` : ""} • WhatsApp: {ped.telefone}
                    </p>
                    {ped.mensagem_cliente && (
                      <p className="text-xs italic text-muted-foreground bg-background/80 p-2 rounded border">
                        "{ped.mensagem_cliente}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                      onClick={() => setAprovandoPedidoCertificado(ped)}
                    >
                      Analisar e Decidir
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 2. Solicitações de Acesso a RH e Financeiro (admin e supervisor) */}
        {["admin", "supervisor"].includes(user?.role || "") && solicitacoesAcesso.length > 0 && (
          <Card className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
            <CardHeader className="pb-3 border-b border-amber-200 dark:border-amber-900/50 bg-amber-100/50 dark:bg-amber-900/20">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-900 dark:text-amber-300">
                <Lock className="w-5 h-5 text-amber-600" />
                Solicitações de Acesso Temporário ({solicitacoesAcesso.length})
              </CardTitle>
              <CardDescription className="text-xs text-amber-800/80 dark:text-amber-400/80">
                Colaboradores pedindo acesso temporário às áreas restritas (RH, Financeiro).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-amber-200/50 dark:divide-amber-900/30">
              {solicitacoesAcesso.map((sol) => (
                <div key={sol.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{sol.usuarios?.nome || "Colaborador"}</span>
                      <span className="text-xs text-muted-foreground">pediu acesso a</span>
                      <Badge variant="outline" className="uppercase font-bold text-[10px] tracking-wide border-amber-400 text-amber-800 dark:text-amber-300">
                        {sol.area}
                      </Badge>
                      <span className="text-xs text-muted-foreground">em</span>
                      <span className="font-semibold text-xs text-foreground">{sol.clientes?.nome_fantasia || "Cliente"}</span>
                    </div>
                    <p className="text-xs italic text-muted-foreground bg-background/80 p-2 rounded border">
                      "{sol.motivo}"
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Pedido há {formatRelativeTime(new Date(sol.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={async () => {
                        const resposta = window.prompt("Motivo da recusa (opcional):");
                        try {
                          await supabase.rpc("decidir_solicitacao", {
                            p_solicitacao: sol.id,
                            p_decisor: user?.id,
                            p_aprovar: false,
                            p_resposta: resposta || "Negado pelo gestor",
                          });
                          toast.info("Solicitação de acesso negada.");
                          fetchPendenciasAprovacao();
                        } catch (e: any) {
                          toast.error(e.message || "Erro ao negar solicitação");
                        }
                      }}
                    >
                      Negar
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
                      onClick={async () => {
                        try {
                          await supabase.rpc("decidir_solicitacao", {
                            p_solicitacao: sol.id,
                            p_decisor: user?.id,
                            p_aprovar: true,
                          });
                          toast.success("Acesso temporário liberado com sucesso!");
                          fetchPendenciasAprovacao();
                        } catch (e: any) {
                          toast.error(e.message || "Erro ao aprovar solicitação");
                        }
                      }}
                    >
                      Aprovar Acesso
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Modal de Confirmação do Certificado */}
        {aprovandoPedidoCertificado && user?.id && (
          <CertificadoAprovacaoModal
            open={!!aprovandoPedidoCertificado}
            onOpenChange={(op) => !op && setAprovandoPedidoCertificado(null)}
            pedido={aprovandoPedidoCertificado}
            adminId={user.id}
            onSuccess={() => {
              setAprovandoPedidoCertificado(null);
              fetchPendenciasAprovacao();
            }}
          />
        )}

        {/* Painel de Alertas Ativos */}
        <Card className="rounded-xl bg-card border-0 shadow-none overflow-hidden">
          <CardHeader className="pb-4 border-b border-border">
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Alertas Ativos
            </CardTitle>
            <CardDescription>
              Conversas que já estouraram o prazo de resposta ({activeAlerts.length}).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
             {activeAlerts.length === 0 ? (
               <div className="text-[13px] text-muted-foreground p-8 text-center">
                 Tudo em dia! Nenhum cliente esperando fora do prazo no momento.
               </div>
             ) : (
               <div className="divide-y divide-border">
                 {activeAlerts.map(c => (
                   <Link key={c.id} to={`/chat/${c.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                      <InitialsAvatar name={c.clientName} src={c.clientAvatar} />
                      <div className="flex-1 min-w-0 flex flex-col">
                         <span className="font-bold text-sm truncate">{c.clientName}</span>
                         <span className="text-[13px] text-muted-foreground truncate">{c.lastMessage || "Sem mensagens"}</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                         <span className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1">
                           SLA Estourado
                         </span>
                         <span className="text-xs text-muted-foreground">
                           Ultima msg: {formatRelativeTime(c.lastMessageTime)}
                         </span>
                      </div>
                   </Link>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>

        {/* Configurações de Automação de Alerta */}
        <Card className="rounded-xl bg-card border-0 shadow-none overflow-hidden">
          <CardHeader className="pb-6">
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
                          <PillToggle
                            key={dia.id}
                            active={alerta.dias_semana.includes(dia.id)}
                            onClick={() => toggleDia(dia.id)}
                          >
                            {dia.label}
                          </PillToggle>
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
                        className="min-h-[220px] bg-transparent border-none text-slate-100 text-[13px] leading-relaxed resize-none focus-visible:ring-0 p-0"
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
          <div className="p-6 rounded-xl bg-card border border-border flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-[13px]">Monitoramento 24h</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Nossa IA monitora seus atendimentos a cada 30 minutos em busca de atrasos.</p>
            </div>
          </div>
          
          <div className="p-6 rounded-xl bg-card border border-border flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-[13px]">Escala de Gestão</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Garanta que nenhum cliente fique sem resposta por mais tempo do que o configurado.</p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-[13px]">Notificações Diretas</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Receba os alertas diretamente no WhatsApp configurado da gestão.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
