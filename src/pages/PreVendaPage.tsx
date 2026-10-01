import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { InitialsAvatar, Chip } from "@/components/conta-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Trophy,
  XCircle,
  Clock,
  Calendar,
  MessageSquare,
  DollarSign,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { OportunidadeDrawer } from "@/components/prevenda/OportunidadeDrawer";
import { MotivoPerdaModal } from "@/components/prevenda/MotivoPerdaModal";
import { GanhoClienteModal } from "@/components/prevenda/GanhoClienteModal";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Oportunidade {
  id: string;
  tenant_id: string;
  conversa_id?: string;
  nome_contato: string;
  telefone?: string;
  empresa_nome?: string;
  cnpj?: string;
  regime_pretendido?: string;
  servicos?: string[];
  colaboradores?: string;
  valor_mensal_estimado?: number;
  origem: string;
  etapa: "novo_lead" | "qualificacao" | "proposta_enviada" | "negociacao" | "ganho" | "perdido";
  responsavel_id?: string;
  proximo_passo?: string;
  proximo_contato_em?: string;
  motivo_perda?: string;
  observacoes?: string;
  cliente_id?: string;
  ganho_em?: string;
  perdido_em?: string;
  created_at: string;
  updated_at: string;
}

const ETAPAS_ABERTAS = [
  { id: "novo_lead", label: "Novo Lead", color: "bg-blue-500" },
  { id: "qualificacao", label: "Qualificação", color: "bg-amber-500" },
  { id: "proposta_enviada", label: "Proposta Enviada", color: "bg-violet-500" },
  { id: "negociacao", label: "Negociação", color: "bg-pink-500" },
];

export default function PreVendaPage() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [search, setSearch] = useState("");
  const [draggedOpId, setDraggedOpId] = useState<string | null>(null);

  // Totais históricos e métricas (últimos 90 dias)
  const [totais90d, setTotais90d] = useState({ ganhos: 0, perdidos: 0, valorGanhos: 0 });
  const [tempoEtapas, setTempoEtapas] = useState<Record<string, number>>({});

  // Drawer de edição
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modais de transição de etapa
  const [opParaPerda, setOpParaPerda] = useState<Oportunidade | null>(null);
  const [modalPerdaOpen, setModalPerdaOpen] = useState(false);
  const [opParaGanho, setOpParaGanho] = useState<Oportunidade | null>(null);
  const [modalGanhoOpen, setModalGanhoOpen] = useState(false);
  const [submittingMover, setSubmittingMover] = useState(false);

  const fetchOportunidades = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);

      // 1. Oportunidades
      const { data, error } = await supabase
        .from("oportunidades")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setOportunidades(data || []);

      // 2. Tempo médio por etapa via view
      const { data: tempos } = await supabase
        .from("vw_tempo_por_etapa")
        .select("*")
        .eq("tenant_id", user.tenantId);

      if (tempos) {
        const mapa: Record<string, number> = {};
        tempos.forEach((t: any) => {
          mapa[t.etapa] = t.dias_medios || 0;
        });
        setTempoEtapas(mapa);
      }

      // 3. Totais 90 dias (ganho e perdido)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);
      const iso90 = dataLimite.toISOString();

      const { data: encerradas } = await supabase
        .from("oportunidades")
        .select("etapa, valor_mensal_estimado, ganho_em, perdido_em")
        .eq("tenant_id", user.tenantId)
        .in("etapa", ["ganho", "perdido"])
        .or(`ganho_em.gte.${iso90},perdido_em.gte.${iso90}`);

      if (encerradas) {
        let g = 0;
        let p = 0;
        let v = 0;
        encerradas.forEach((op: any) => {
          if (op.etapa === "ganho") {
            g++;
            v += Number(op.valor_mensal_estimado || 0);
          } else if (op.etapa === "perdido") {
            p++;
          }
        });
        setTotais90d({ ganhos: g, perdidos: p, valorGanhos: v });
      }
    } catch (err: any) {
      console.error("Erro ao carregar pré-venda:", err);
      toast.error("Erro ao carregar o funil de pré-venda");
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchOportunidades();
  }, [fetchOportunidades]);

  // Realtime subscription para oportunidades
  useEffect(() => {
    if (!user?.tenantId) return;

    const channel = supabase
      .channel("realtime-oportunidades")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oportunidades",
          filter: `tenant_id=eq.${user.tenantId}`,
        },
        () => {
          fetchOportunidades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.tenantId, fetchOportunidades]);

  // Indicadores do topo
  const kpis = useMemo(() => {
    const abertas = oportunidades.filter((op) => op.etapa !== "ganho" && op.etapa !== "perdido");
    const valorEmNegociacao = abertas.reduce((acc, curr) => acc + (Number(curr.valor_mensal_estimado) || 0), 0);

    const totalEncerrados90 = totais90d.ganhos + totais90d.perdidos;
    const taxaConversao = totalEncerrados90 > 0 ? Math.round((totais90d.ganhos / totalEncerrados90) * 100) : 0;

    return {
      leadsAbertos: abertas.length,
      valorEmNegociacao,
      taxaConversao,
    };
  }, [oportunidades, totais90d]);

  const oportunidadesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return oportunidades;
    return oportunidades.filter((op) => {
      return (
        op.nome_contato.toLowerCase().includes(q) ||
        (op.empresa_nome || "").toLowerCase().includes(q) ||
        (op.telefone || "").includes(q) ||
        (op.cnpj || "").includes(q)
      );
    });
  }, [oportunidades, search]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedOpId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, etapaDestino: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedOpId;
    setDraggedOpId(null);
    if (!id || !user?.id) return;

    const op = oportunidades.find((o) => o.id === id);
    if (!op || op.etapa === etapaDestino) return;

    if (etapaDestino === "ganho") {
      setOpParaGanho(op);
      setModalGanhoOpen(true);
      return;
    }

    if (etapaDestino === "perdido") {
      setOpParaPerda(op);
      setModalPerdaOpen(true);
      return;
    }

    // Mudança entre etapas abertas normais
    try {
      const { error } = await supabase.rpc("mover_oportunidade", {
        p_oportunidade: op.id,
        p_usuario: user.id,
        p_etapa: etapaDestino,
      });

      if (error) throw error;
      toast.success("Etapa da oportunidade atualizada!");
      fetchOportunidades();
    } catch (err: any) {
      console.error("Erro ao mover oportunidade:", err);
      toast.error(err.message || "Erro ao mover oportunidade");
    }
  };

  const handleConfirmarPerda = async (motivo: string) => {
    if (!opParaPerda || !user?.id) return;
    try {
      setSubmittingMover(true);
      const { error } = await supabase.rpc("mover_oportunidade", {
        p_oportunidade: opParaPerda.id,
        p_usuario: user.id,
        p_etapa: "perdido",
        p_motivo_perda: motivo,
      });

      if (error) throw error;
      toast.success("Oportunidade arquivada como perdida.");
      setModalPerdaOpen(false);
      setOpParaPerda(null);
      fetchOportunidades();
    } catch (err: any) {
      console.error("Erro ao registrar perda:", err);
      toast.error(err.message || "Erro ao registrar perda");
    } finally {
      setSubmittingMover(false);
    }
  };

  const handleConfirmarGanho = async (clienteId: string) => {
    if (!opParaGanho || !user?.id) return;
    try {
      const { error } = await supabase.rpc("mover_oportunidade", {
        p_oportunidade: opParaGanho.id,
        p_usuario: user.id,
        p_etapa: "ganho",
        p_cliente: clienteId,
      });

      if (error) throw error;
      toast.success("Oportunidade ganha! Conversa movida para Atendimento.");
      setModalGanhoOpen(false);
      setOpParaGanho(null);
      fetchOportunidades();
    } catch (err: any) {
      console.error("Erro ao registrar ganho:", err);
      toast.error(err.message || "Erro ao registrar ganho");
    }
  };

  const hoje = startOfDay(new Date());

  return (
    <div className="flex flex-col gap-5 px-8 pb-8 h-[calc(100vh-4rem)]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight">Pré-venda (Comercial)</h1>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              Gestão de Oportunidades
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe a qualificação de novos leads, envio de propostas e fechamento de novos clientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contato, empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-full text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOportunidades}
            disabled={loading}
            className="h-9 gap-1.5 rounded-full text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Indicadores do Topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
        <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Leads Abertos</span>
          <span className="text-2xl font-extrabold tabular text-primary mt-1">
            {kpis.leadsAbertos}
          </span>
          <span className="text-[11px] text-muted-foreground">No funil de vendas ativo</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Em Negociação</span>
          <span className="text-2xl font-extrabold tabular text-emerald-600 mt-1">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              kpis.valorEmNegociacao
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">Valor mensal estimado</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Conversão (90 dias)</span>
          <span className="text-2xl font-extrabold tabular text-amber-600 mt-1">
            {kpis.taxaConversao}%
          </span>
          <span className="text-[11px] text-muted-foreground">
            {totais90d.ganhos} ganhos ÷ {totais90d.ganhos + totais90d.perdidos} encerrados
          </span>
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Tempo Médio / Etapa</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-muted-foreground">Proposta:</span>
            <span className="text-sm font-extrabold text-foreground">
              {tempoEtapas["proposta_enviada"] ? `${tempoEtapas["proposta_enviada"]}d` : "–"}
            </span>
            <span className="text-xs font-bold text-muted-foreground ml-2">Negoc.:</span>
            <span className="text-sm font-extrabold text-foreground">
              {tempoEtapas["negociacao"] ? `${tempoEtapas["negociacao"]}d` : "–"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5">Duração média das conversas</span>
        </div>
      </div>

      {/* Quadro de Etapas (Kanban) */}
      <div className="flex-1 overflow-x-auto min-h-0">
        <div className="flex gap-4 min-w-max h-full pb-2">
          {ETAPAS_ABERTAS.map((col) => {
            const items = oportunidadesFiltradas.filter((op) => op.etapa === col.id);
            const totalValor = items.reduce(
              (acc, curr) => acc + (Number(curr.valor_mensal_estimado) || 0),
              0
            );

            return (
              <div
                key={col.id}
                className="w-80 flex flex-col bg-card rounded-2xl border border-border overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Header da Coluna */}
                <div className="p-3.5 flex items-center justify-between border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      {col.label}
                    </span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  {totalValor > 0 && (
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(totalValor)}
                    </span>
                  )}
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                  {items.map((op) => {
                    const responsavel = store.users.find((u) => u.id === op.responsavel_id);
                    const proximoContato = op.proximo_contato_em
                      ? new Date(op.proximo_contato_em + "T00:00:00")
                      : null;
                    const isAtrasado = proximoContato ? isBefore(proximoContato, hoje) : false;

                    return (
                      <div
                        key={op.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, op.id)}
                        onClick={() => {
                          setSelectedOpId(op.id);
                          setDrawerOpen(true);
                        }}
                        className={`group bg-background rounded-xl p-3.5 border border-border shadow-xs hover:border-primary/50 cursor-pointer transition-all ${
                          draggedOpId === op.id ? "opacity-40 scale-95" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <InitialsAvatar
                              name={op.empresa_nome || op.nome_contato}
                              size={28}
                              shape={op.empresa_nome ? "tile" : "circle"}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-foreground truncate">
                                {op.empresa_nome || op.nome_contato}
                              </p>
                              {op.empresa_nome && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {op.nome_contato}
                                </p>
                              )}
                            </div>
                          </div>

                          <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 cursor-grab" />
                        </div>

                        {/* Valor & Origem */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                          <span className="text-xs font-extrabold text-emerald-600">
                            {op.valor_mensal_estimado
                              ? new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(op.valor_mensal_estimado)
                              : "Sem valor"}
                          </span>

                          <Chip tone="soft" className="text-[10px] capitalize">
                            {op.origem.replace("_", " ")}
                          </Chip>
                        </div>

                        {/* Próximo contato / Atraso */}
                        <div className="flex items-center justify-between mt-2 text-[11px]">
                          {proximoContato ? (
                            <span
                              className={`flex items-center gap-1 font-semibold ${
                                isAtrasado
                                  ? "text-destructive font-bold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {format(proximoContato, "dd/MM")}
                              {isAtrasado && " (atrasado)"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[10px]">Sem data</span>
                          )}

                          {op.conversa_id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/chat/${op.conversa_id}`);
                              }}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Conversa
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Colunas Finais de Encerramento (Ganho / Perdido) */}
          <div className="w-80 flex flex-col gap-4">
            {/* Coluna Ganho */}
            <div
              className="flex-1 flex flex-col bg-success/5 rounded-2xl border-2 border-dashed border-success/30 p-4 transition-colors"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "ganho")}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-success uppercase">
                  <Trophy className="h-4 w-4" />
                  Soltar aqui: Ganho
                </span>
                <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                  {totais90d.ganhos} nos 90d
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cadastra o cliente no sistema e move a conversa para o funil de Atendimento.
              </p>
              <div className="mt-auto pt-3 border-t border-success/20 flex items-center justify-between text-xs font-bold text-success">
                <span>Valor ganho (90d):</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(totais90d.valorGanhos)}
                </span>
              </div>
            </div>

            {/* Coluna Perdido */}
            <div
              className="flex-1 flex flex-col bg-destructive/5 rounded-2xl border-2 border-dashed border-destructive/30 p-4 transition-colors"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "perdido")}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-destructive uppercase">
                  <XCircle className="h-4 w-4" />
                  Soltar aqui: Perdido
                </span>
                <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  {totais90d.perdidos} nos 90d
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Arquiva a oportunidade pedindo o motivo para métricas de conversão.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer e Modais */}
      <OportunidadeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        oportunidadeId={selectedOpId}
        onSaved={fetchOportunidades}
      />

      <MotivoPerdaModal
        open={modalPerdaOpen}
        onOpenChange={setModalPerdaOpen}
        onConfirm={handleConfirmarPerda}
        loading={submittingMover}
      />

      <GanhoClienteModal
        open={modalGanhoOpen}
        onOpenChange={setModalGanhoOpen}
        oportunidade={opParaGanho}
        onSuccess={handleConfirmarGanho}
      />
    </div>
  );
}
