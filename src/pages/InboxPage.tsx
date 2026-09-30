import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, formatRelativeTime } from "@/lib/store";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useListKeyboardNav } from "@/hooks/useListNavigation";
import { useSound } from "@/hooks/useSound";
import { Button } from "@/components/ui/button";
import { Search, Users, RefreshCw, AlertTriangle, Volume2, VolumeX, UserPlus, MessageSquare } from "lucide-react";
import { Chip, FilterGroup, FilterOption, InitialsAvatar, PillToggle, type ChipTone } from "@/components/conta-ui";
import { checkConnection } from "@/lib/evolution";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { insertHistorico } from "@/lib/historico";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotification } from "@/hooks/useNotifications";
import { toast } from "sonner";

type Filter = "todas" | "fila" | "minhas" | "nao_lidas" | "grupos";
type StatusFilter = "todos" | "novo" | "em_atendimento" | "aguardando_cliente" | "resolvido";
type SortMode = "urgencia" | "recentes";

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  pendente: "Pendente",
  aguardando_aceite: "Aguardando aceite",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  respondido: "Respondido",
  resolvido: "Resolvido",
};

const STATUS_TONE: Record<string, ChipTone> = {
  novo: "blue",
  aguardando_aceite: "soft",
  em_atendimento: "soft",
  aguardando_cliente: "grey",
  resolvido: "green",
};

const SLA_RANK = { estourado: 0, em_risco: 1, ok: 2 } as const;

export default function InboxPage() {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play: playNewMessage, isMuted: soundMuted, toggleMute: toggleSound } = useSound({ soundType: "new_message", volume: 0.3 });

  // State Management
  const [filter, setFilter] = useState<Filter>("todas");
  const [hasSetDefaultFilter, setHasSetDefaultFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [waConnected, setWaConnected] = useState(
    localStorage.getItem("wa_connected") === "true"
  );
  const [loading, setLoading] = useState(false);
  const [prevConversationCount, setPrevConversationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [slaFilter, setSlaFilter] = useState<{ em_risco: boolean; estourado: boolean }>({ em_risco: false, estourado: false });
  const [sortMode, setSortMode] = useState<SortMode>("urgencia");
  const conversationsRef = useRef<{ id: string }[]>([]);

  // 1. Helpers e FetchData
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Conta+`;
    } else {
      document.title = "Conta+";
    }
  }, [unreadCounts]);

  const fetchData = useCallback(async () => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;

    try {
      const query = supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", tenantId);

      const { data: dbConvs, error } = await query.order("last_message_time", { ascending: false });

      if (error) {
        console.error("Erro ao buscar conversas:", error);
        return;
      }

      if (dbConvs && dbConvs.length > 0) {
        // Buscar contagem de não lidas
        const convIds = dbConvs.map(c => c.id);
        if (convIds.length > 0) {
          const { data: unreadData } = await supabase
            .from('mensagens')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .eq('sender', 'client')
            .is('read_at', null);
          
          if (unreadData) {
            const counts: Record<string, number> = {};
            unreadData.forEach(m => {
              counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
            });
            setUnreadCounts(counts);
          }
        }

        const formattedConvs = dbConvs.map(c => ({
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
          isGroup: c.is_group,
          clientAvatar: c.client_avatar,
          protocolo: c.protocolo,
          resolvedAt: c.resolved_at
        }));
        storeRef.current.addDbConversations(formattedConvs);
      }
    } catch (err) {
      console.error("Erro na busca de conversas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId]);

  const handleManualRefresh = useCallback(async () => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: dbConvs } = await supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", tenantId);
      
      if (dbConvs) {
        dbConvs.forEach(c => {
          storeRef.current.addDbConversation({
            id: c.id,
            clientName: c.client_name || "Cliente sem nome",
            clientPhone: c.client_phone || "",
            lastMessage: c.last_message || "",
            lastMessageTime: new Date(c.last_message_time || Date.now()),
            status: c.status || "novo",
            assignedTo: c.assigned_to,
            tenantId: c.tenant_id,
            tags: c.tags || [],
            isGroup: c.is_group,
            clientAvatar: c.client_avatar,
            protocolo: c.protocolo,
            resolvedAt: c.resolved_at
          });
        });
      }

      const status = await checkConnection();
      setWaConnected(status.connected);
    } catch (err) {
      console.error("Erro no refresh:", err);
    }
    setLoading(false);
  }, [user?.tenantId]);

  // 2. Effects
  useEffect(() => {
    if (user) {
      storeRef.current.setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    if (user && !hasSetDefaultFilter) {
      setFilter("todas");
      setHasSetDefaultFilter(true);
    }
  }, [user, hasSetDefaultFilter]);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const status = await checkConnection();
        if (mounted) {
          setWaConnected(status.connected);
          if (status.connected) {
            localStorage.setItem("wa_connected", "true");
          } else {
            localStorage.removeItem("wa_connected");
          }
        }
      } catch (err) {
        if (mounted) {
          // Manter ultimo estado conhecido do localStorage
          setWaConnected(localStorage.getItem("wa_connected") === "true");
        }
      }
    };

    check();

    // Verificar conexão a cada 30s para detectar desconexões
    const interval = setInterval(check, 30000);

    // Solicitar permissão de notificação
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const { notify } = useNotification();

  // IMPLEMENTAÇÃO 1.2: Canal Realtime UNIFICADO
  useRealtimeChat({
    tenantId: user?.tenantId,
    userId: user?.id,
    enabled: true,
    notify: notify
  });

  // useEffect para quando o FILTRO muda ou o tenantId inicializa
  useEffect(() => {
    if (user?.tenantId) {
      fetchData();
    }
  }, [filter, user?.tenantId, fetchData]);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!user?.tenantId) return;
      const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("tenant_id", user.tenantId);
      
      if (data) {
        storeRef.current.setUsers(data.map(d => ({
          id: d.id,
          name: d.nome,
          email: d.email,
          role: d.role as any,
          tenantId: d.tenant_id,
          avatar: d.avatar,
          whatsapp: d.whatsapp
        })));
      }
    };
    fetchTeam();
  }, [user?.tenantId]);

  // 3. Função de atribuição rápida - IMPLEMENTAÇÃO 2
  const handleQuickAssign = async (convId: string, userId: string) => {
    try {
      await supabase.from('conversas').update({ 
        assigned_to: userId,
        status: 'em_atendimento',
        started_at: new Date().toISOString()
      }).eq('id', convId);
      
      await insertHistorico({
        conversation_id: convId,
        action: `Atribuída para ${store.users.find(u => u.id === userId)?.name}`,
        user_id: user?.id,
        user_name: user?.name,
      });
      
      toast.success('Conversa atribuída!');
      fetchData();
    } catch {
      toast.error('Erro ao atribuir');
    }
  };

  // 4. Memoized Data
  const allConversations = useMemo(() => store.conversations || [], [store.conversations]);

  const matchesView = useCallback((c: (typeof allConversations)[number], view: Filter) => {
    const open = c.status?.toLowerCase() !== "resolvido";
    switch (view) {
      case "fila": return !c.isGroup && open && !c.assignedTo;
      case "minhas": return !c.isGroup && open && c.assignedTo === user?.id;
      case "nao_lidas": return (unreadCounts[c.id] || 0) > 0;
      case "grupos": return !!c.isGroup;
      default: return !c.isGroup;
    }
  }, [unreadCounts, user?.id]);

  const inView = useMemo(
    () => allConversations.filter(c => matchesView(c, filter)),
    [allConversations, filter, matchesView]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const anySla = slaFilter.em_risco || slaFilter.estourado;
    const convs = inView.filter(c => {
      if (statusFilter !== "todos") {
        const st = c.status?.toLowerCase();
        if (statusFilter === "em_atendimento" ? !(st === "em_atendimento" || st === "aguardando_aceite") : st !== statusFilter) return false;
      }
      if (anySla) {
        const sla = store.getSLAStatus(c);
        if (!((slaFilter.em_risco && sla === "em_risco") || (slaFilter.estourado && sla === "estourado"))) return false;
      }
      if (!q) return true;
      return (
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.lastMessage || "").toLowerCase().includes(q) ||
        (c.clientPhone || "").includes(q) ||
        String(c.protocolo || "").includes(q)
      );
    });

    convs.sort((a, b) => {
      if (sortMode === "urgencia") {
        const r = SLA_RANK[store.getSLAStatus(a)] - SLA_RANK[store.getSLAStatus(b)];
        if (r !== 0) return r;
      }
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });
    return convs;
  }, [inView, statusFilter, slaFilter, search, sortMode, store]);

  const counts = useMemo(() => ({
    todas: allConversations.filter(c => matchesView(c, "todas")).length,
    fila: allConversations.filter(c => matchesView(c, "fila")).length,
    minhas: allConversations.filter(c => matchesView(c, "minhas")).length,
    nao_lidas: allConversations.filter(c => matchesView(c, "nao_lidas")).length,
    grupos: allConversations.filter(c => matchesView(c, "grupos")).length,
  }), [allConversations, matchesView]);

  const statusCounts = useMemo(() => {
    const by = (fn: (st: string) => boolean) => inView.filter(c => fn(c.status?.toLowerCase() || "")).length;
    return {
      todos: inView.length,
      novo: by(st => st === "novo"),
      em_atendimento: by(st => st === "em_atendimento" || st === "aguardando_aceite"),
      aguardando_cliente: by(st => st === "aguardando_cliente"),
      resolvido: by(st => st === "resolvido"),
    };
  }, [inView]);

  const slaCounts = useMemo(() => ({
    em_risco: inView.filter(c => store.getSLAStatus(c) === "em_risco").length,
    estourado: inView.filter(c => store.getSLAStatus(c) === "estourado").length,
  }), [inView, store]);

  useEffect(() => {
    if (filtered.length > prevConversationCount && prevConversationCount > 0) {
      playNewMessage();
    }
    setPrevConversationCount(filtered.length);
    conversationsRef.current = filtered.map(c => ({ id: c.id }));
  }, [filtered.length, prevConversationCount, playNewMessage]);

  const handleSelectConversation = useCallback((id: string) => {
    navigate(`/chat/${id}`);
  }, [navigate]);

  useListKeyboardNav(conversationsRef.current, handleSelectConversation);

  const syncAvatar = useCallback((convId: string) => {
    fetch("/api/sync-avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.url) storeRef.current.addDbConversation({ id: convId, clientAvatar: d.url } as never);
      })
      .catch(() => {});
  }, []);

  const VIEWS: { key: Filter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "fila", label: "Fila" },
    { key: "minhas", label: "Minhas" },
    { key: "nao_lidas", label: "Não lidas" },
    { key: "grupos", label: "Grupos" },
  ];

  const canDelegate = ["admin", "supervisor"].includes(user?.role || "");

  if (!user) return null;

  const openCount = statusCounts.todos - statusCounts.resolvido;

  return (
    <div className="grid grid-cols-1 gap-6 px-8 pb-8 lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside aria-label="Filtros" className="flex flex-col gap-6">
        <label className="flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nome, mensagem, telefone..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Search className="h-4 w-4 text-primary" />
        </label>

        <FilterGroup title="Visão">
          <div className="flex flex-wrap gap-1.5">
            {VIEWS.map(v => (
              <PillToggle key={v.key} active={filter === v.key} onClick={() => setFilter(v.key)} count={v.key === "todas" ? undefined : counts[v.key]}>
                {v.label}
              </PillToggle>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Status">
          {([
            ["todos", "Todos"],
            ["novo", "Novo"],
            ["em_atendimento", "Em atendimento"],
            ["aguardando_cliente", "Aguardando cliente"],
            ["resolvido", "Resolvido"],
          ] as [StatusFilter, string][]).map(([key, label]) => (
            <FilterOption
              key={key}
              type="radio"
              name="inbox-status"
              label={label}
              count={statusCounts[key]}
              checked={statusFilter === key}
              onChange={() => setStatusFilter(key)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="SLA">
          <FilterOption
            type="checkbox"
            label="Em risco"
            count={slaCounts.em_risco}
            checked={slaFilter.em_risco}
            onChange={() => setSlaFilter(f => ({ ...f, em_risco: !f.em_risco }))}
          />
          <FilterOption
            type="checkbox"
            label="Estourado"
            count={slaCounts.estourado}
            checked={slaFilter.estourado}
            onChange={() => setSlaFilter(f => ({ ...f, estourado: !f.estourado }))}
          />
        </FilterGroup>
      </aside>

      <section className="flex min-h-[calc(100vh-150px)] min-w-0 flex-col rounded-xl bg-card px-5 pb-2 pt-4">
        {!waConnected && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-destructive/10 p-3 pl-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">WhatsApp desconectado</p>
              <p className="text-xs text-destructive/80">As mensagens não serão enviadas nem recebidas.</p>
            </div>
            {user.role === "admin" && (
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => navigate("/settings")}>
                Conectar
              </Button>
            )}
          </div>
        )}

        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-base font-extrabold">
              {filtered.length} {filtered.length === 1 ? "conversa" : "conversas"}
            </h2>
            <span className="text-xs text-muted-foreground">
              {openCount} abertas · {sortMode === "urgencia" ? "ordenadas por urgência de SLA" : "mais recentes primeiro"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-9 w-[160px] rounded-full text-[13px] font-semibold" aria-label="Ordenar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgencia">Mais urgentes</SelectItem>
                <SelectItem value="recentes">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleManualRefresh} aria-label="Atualizar">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleSound} aria-label={soundMuted ? "Ativar som" : "Silenciar"}>
              {soundMuted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">Carregando conversas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-bold">Nenhuma conversa aqui</p>
            <p className="text-xs text-muted-foreground">Mude a visão, os filtros ou a busca.</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((conv, i) => {
              const sla = store.getSLAStatus(conv);
              const unread = unreadCounts[conv.id] || 0;
              const st = conv.status?.toLowerCase() || "novo";
              const owner = conv.assignedTo ? store.users.find(u => u.id === conv.assignedTo) : undefined;
              return (
                <li
                  key={conv.id}
                  className={cn("flex items-center gap-3", i < filtered.length - 1 && "border-b border-border")}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl px-1 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="relative">
                      <InitialsAvatar
                        name={conv.clientName}
                        src={conv.clientAvatar}
                        icon={conv.isGroup ? <Users className="h-5 w-5" /> : undefined}
                        onImageError={() => {
                          if (conv.clientAvatar?.includes("whatsapp.net") && !conv.isGroup) syncAvatar(conv.id);
                        }}
                      />
                      {st === "novo" && (
                        <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("truncate text-sm", unread > 0 ? "font-extrabold" : "font-bold")}>{conv.clientName}</span>
                        {conv.protocolo && <span className="shrink-0 text-xs text-muted-foreground">#{conv.protocolo}</span>}
                      </span>
                      {conv.isTyping ? (
                        <span className="text-[13px] font-semibold text-primary">digitando...</span>
                      ) : (
                        <span className={cn("truncate text-[13px]", unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {conv.lastMessage || "Sem mensagens"}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(conv.lastMessageTime)}</span>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-primary-foreground tabular">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {owner && <span className="max-w-[110px] truncate text-xs text-muted-foreground">{owner.id === user.id ? "Você" : owner.name}</span>}
                        {sla !== "ok" ? (
                          <Chip tone={sla === "estourado" ? "red" : "amber"}>
                            <AlertTriangle className="h-3 w-3" />
                            {sla === "estourado" ? "SLA estourado" : "SLA em risco"}
                          </Chip>
                        ) : (
                          <Chip tone={STATUS_TONE[st] ?? "grey"}>{STATUS_LABEL[st] ?? st}</Chip>
                        )}
                      </span>
                    </span>
                  </button>

                  {!conv.assignedTo && st !== "resolvido" && !conv.isGroup && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" className="h-8 px-4 text-xs" onClick={() => handleQuickAssign(conv.id, user.id)}>
                        Aceitar
                      </Button>
                      {canDelegate && (
                        <Select onValueChange={uid => handleQuickAssign(conv.id, uid)}>
                          <SelectTrigger className="h-8 w-8 justify-center rounded-full p-0 [&>svg:last-child]:hidden" aria-label="Delegar conversa">
                            <UserPlus className="h-4 w-4" />
                          </SelectTrigger>
                          <SelectContent>
                            {store.users
                              .filter(u => ["atendente", "supervisor", "recepcionista"].includes(u.role))
                              .map(u => (
                                <SelectItem key={u.id} value={u.id} className="text-xs">
                                  {u.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
