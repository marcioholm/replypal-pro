import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, formatDuration, STATUS_CONFIG, ensureDate } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { insertHistorico } from "@/lib/historico";
import type { ConversationStatus } from "@/lib/store";
import { TagBadge } from "@/components/TagBadge";
import { SLABadge } from "@/components/SLABadge";
import { Kanban, GripVertical, Clock, User, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { InitialsAvatar, Chip } from "@/components/conta-ui";

const COLUMNS: ConversationStatus[] = ["novo", "aguardando_aceite", "em_atendimento", "aguardando_cliente", "resolvido"];

const columnColors: Record<ConversationStatus, string> = {
  novo: "bg-primary",
  aguardando_aceite: "bg-amber-500",
  em_atendimento: "bg-accent",
  aguardando_cliente: "bg-violet-500",
  resolvido: "bg-success",
  pendente: "bg-blue-500",
  respondido: "bg-teal-500",
};

export default function PipelinePage() {
  const store = useStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const getColumnConversations = useCallback((status: ConversationStatus) => {
    const tenantId = user?.tenantId;
    return (store.conversations || [])
      .filter((c) => !tenantId || !c.tenantId || c.tenantId === tenantId)
      .filter((c) => (c.funil || "atendimento") === "atendimento")
      .filter((c) => c.status === status)
      .sort((a, b) => {
        const timeA = ensureDate(a.lastMessageTime)?.getTime() || 0;
        const timeB = ensureDate(b.lastMessageTime)?.getTime() || 0;
        return timeB - timeA;
      });
  }, [store.conversations, user?.tenantId]);

  const fetchData = useCallback(async () => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", tenantId);

      if (error) {
        console.error("Erro ao buscar conversas do pipeline:", error);
        return;
      }

      if (data && data.length > 0) {
        data.forEach(c => {
          store.addDbConversation({
            id: c.id,
            clientName: c.client_name || "Cliente sem nome",
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
            funil: c.funil,
            arquivoMotivo: c.arquivo_motivo
          });
        });
      }
    } catch (err) {
      console.error("Erro no fetch do pipeline:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, store, supabase]);

  useEffect(() => {
    if (user?.tenantId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [user?.tenantId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.tenantId) {
        fetchData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user?.tenantId, fetchData]);

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, convId: string) => {
    setDraggedId(convId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const canMoveCard = useCallback((convId: string) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    const conv = store.getConversation(convId);
    return conv?.assignedTo === user.id;
  }, [user, store]);

  const handleDrop = (e: React.DragEvent, targetStatus: ConversationStatus) => {
    e.preventDefault();
    if (!draggedId || !user) return;
    if (!canMoveCard(draggedId)) return;
    const conv = store.getConversation(draggedId);
    if (conv && conv.status !== targetStatus) {
      store.updateStatus(draggedId, targetStatus, store.currentUser);
      
      // Se resolver, remover atribuição e registrar
      if (targetStatus === "resolvido") {
        supabase.from("conversas").update({ 
          assigned_to: null, 
          resolved_at: new Date().toISOString() 
        }).eq("id", draggedId).then(() => {
          insertHistorico([{
            conversation_id: draggedId,
            action: "Atendimento encerrado (Pipeline)",
            user_id: user.id,
            user_name: user.name
          }, {
            conversation_id: draggedId,
            action: "Chamado resolvido",
            user_id: user.id,
            user_name: user.name,
            details: "Responsável removido automaticamente."
          }]);
        });
      }
    }
    setDraggedId(null);
  };

  const totalConversations = useMemo(() => {
    const tenantId = user?.tenantId;
    return (store.conversations || [])
      .filter(c => !tenantId || !c.tenantId || c.tenantId === tenantId)
      .length;
  }, [store.conversations, user?.tenantId]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground mt-4">Carregando pipeline...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-8 pb-8 h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between pt-5">
        <div className="text-[13px] font-semibold text-muted-foreground">
          {totalConversations} conversas no funil
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto min-h-0">
        <div className="flex gap-4 min-w-max h-full">
          {COLUMNS.map((status) => {
            const convs = getColumnConversations(status);
            const config = STATUS_CONFIG[status];
            return (
              <div
                key={status}
                className="w-80 flex flex-col bg-card rounded-xl"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${columnColors[status]}`} />
                  <span className="text-[13px] font-bold tracking-tight">{config.label}</span>
                  <span className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground ml-auto font-bold">
                    {convs.length}
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-3 scrollbar-thin">
                  {convs.map((conv) => {
                    const sla = store.getSLAStatus(conv);
                    const isAtRisk = sla === "em_risco" || sla === "estourado";
                    const assignedUser = store.users.find(u => u.id === conv.assignedTo);
                    const clientName = conv.clientName || "Cliente sem nome";
                    return (
                      <div
                        key={conv.id}
                        draggable={canMoveCard(conv.id)}
                        onDragStart={(e) => handleDragStart(e, conv.id)}
                        onClick={() => navigate(`/chat/${conv.id}`)}
                        className={`bg-background rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors group ${draggedId === conv.id ? "opacity-50 scale-95" : ""} ${isAtRisk ? "border-l-4 border-l-destructive" : ""} ${!canMoveCard(conv.id) ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <GripVertical className={`w-4 h-4 shrink-0 ${canMoveCard(conv.id) ? "text-muted-foreground/40 cursor-grab" : "text-muted-foreground/20 cursor-not-allowed"}`} />
                          <InitialsAvatar name={clientName} size={36} shape="circle" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold truncate">{clientName}</p>
                            {assignedUser && (
                              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {assignedUser.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 pl-7">{conv.lastMessage || "Sem mensagem"}</p>
                        <div className="flex items-center gap-2 flex-wrap pl-7">
                          {(conv.tags || []).slice(0, 2).map((t) => <TagBadge key={t} tagId={t} />)}
                          {isAtRisk && (
                            <Chip tone="red">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              SLA
                            </Chip>
                          )}
                          {status !== "resolvido" && !isAtRisk && <SLABadge slaStatus={sla} />}
                          {conv.startedAt && (
                            <span className="text-[11px] font-semibold text-muted-foreground ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(conv.startedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {convs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/40 text-xs">
                      Nenhuma conversa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}