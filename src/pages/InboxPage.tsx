import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, formatRelativeTime } from "@/lib/store";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useListKeyboardNav } from "@/hooks/useListNavigation";
import { useSound } from "@/hooks/useSound";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserCheck, Users, Inbox as InboxIcon, Mail, RefreshCw, AlertTriangle, Clock, Volume2, VolumeX, Keyboard } from "lucide-react";
import { checkConnection } from "@/lib/evolution";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Filter = "todas" | "minhas" | "pendentes";

export default function InboxPage() {
  const store = useStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play: playNewMessage, isMuted: soundMuted, toggleMute: toggleSound } = useSound({ soundType: "new_message", volume: 0.3 });
  
  useEffect(() => {
    if (user) {
      store.setCurrentUser(user);
    }
  }, [user, store]);

  const [filter, setFilter] = useState<Filter>("minhas");
  const [search, setSearch] = useState("");
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [prevConversationCount, setPrevConversationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const conversationsRef = useRef<{ id: string }[]>([]);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      try {
        const status = await checkConnection();
        setWaConnected(status.connected);
      } catch (err) {
        console.error("Erro ao verificar conexão WhatsApp:", err);
        setWaConnected(false);
      }
    };
    check();
  }, []);

  const fetchData = useCallback(async () => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;

    try {
      let query = supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", tenantId);

      if (filter === "minhas") {
        query = query.eq("assigned_to", user?.id);
      } else if (filter === "pendentes") {
        query = query.or(`assigned_to.is.null,status.eq.novo`);
      }

      const { data: dbConvs, error } = await query.order("last_message_time", { ascending: false });

      if (error) {
        console.error("Erro ao buscar conversas:", error);
        return;
      }

      if (dbConvs && dbConvs.length > 0) {
        dbConvs.forEach(c => {
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
            tags: c.tags || []
          });
        });
      }
    } catch (err) {
      console.error("Erro na busca de conversas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId, user?.id, filter, store, supabase]);

  useEffect(() => {
    if (hasFetchedRef.current && user?.tenantId) {
      fetchData();
    }
  }, [filter]);

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
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.tenantId, fetchData]);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!user?.tenantId) return;
      const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("tenant_id", user.tenantId);
      
      if (data) {
        store.setUsers(data.map(d => ({
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
          store.addDbConversation({
            id: c.id,
            clientName: c.client_name || "Cliente sem nome",
            clientPhone: c.client_phone || "",
            lastMessage: c.last_message || "",
            lastMessageTime: new Date(c.last_message_time || Date.now()),
            status: c.status || "novo",
            assignedTo: c.assigned_to,
            tenantId: c.tenant_id,
            tags: c.tags || []
          });
        });
      }

      const status = await checkConnection();
      setWaConnected(status.connected);
    } catch (err) {
      console.error("Erro no refresh:", err);
    }
    setLoading(false);
  }, [user?.tenantId, store, supabase]);

  const allConversations = useMemo(() => store.conversations || [], [store.conversations]);

  if (!user) return null;

  useRealtimeChat({
    tenantId: user?.tenantId,
    userId: user?.id,
    enabled: true,
  });

  const filtered = useMemo(() => {
    let convs = allConversations.filter(c => {
      if (filter === "minhas") return c.assignedTo === user?.id;
      if (filter === "pendentes") return !c.assignedTo || c.status === "novo";
      return true;
    }).filter(c => {
      if (!search) return true;
      const name = (c.clientName || "").toLowerCase();
      const message = (c.lastMessage || "").toLowerCase();
      const phone = c.clientPhone || "";
      return (
        name.includes(search.toLowerCase()) || 
        message.includes(search.toLowerCase()) ||
        phone.includes(search)
      );
    });

    convs.sort((a, b) => {
      if (a.status === "novo" && b.status !== "novo") return -1;
      if (b.status === "novo" && a.status !== "novo") return 1;
      const slaA = store.getSLAStatus(a);
      const slaB = store.getSLAStatus(b);
      if ((slaA === "estourado" || slaA === "em_risco") && slaB === "ok") return -1;
      if ((slaB === "estourado" || slaB === "em_risco") && slaA === "ok") return 1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });

    return convs;
  }, [allConversations, filter, user?.id, search, store]);

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

  useListKeyboardNav(
    conversationsRef.current,
    handleSelectConversation,
    true
  );

  const groupedConversations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: { label: string; convs: typeof filtered }[] = [];
    const todayConvs: typeof filtered = [];
    const yesterdayConvs: typeof filtered = [];
    const lastWeekConvs: typeof filtered = [];
    const olderConvs: typeof filtered = [];

    filtered.forEach(c => {
      const msgDate = new Date(c.lastMessageTime);
      msgDate.setHours(0, 0, 0, 0);
      
      if (msgDate.getTime() === today.getTime()) {
        todayConvs.push(c);
      } else if (msgDate.getTime() === yesterday.getTime()) {
        yesterdayConvs.push(c);
      } else if (msgDate >= lastWeek) {
        lastWeekConvs.push(c);
      } else {
        olderConvs.push(c);
      }
    });

    if (todayConvs.length > 0) groups.push({ label: "Hoje", convs: todayConvs });
    if (yesterdayConvs.length > 0) groups.push({ label: "Ontem", convs: yesterdayConvs });
    if (lastWeekConvs.length > 0) groups.push({ label: "Esta Semana", convs: lastWeekConvs });
    if (olderConvs.length > 0) groups.push({ label: "Anteriores", convs: olderConvs });

    return groups;
  }, [filtered]);

  const getAssignedUser = useCallback((assignedTo?: string) => {
    if (!assignedTo) return null;
    return store.users.find(u => u.id === assignedTo) || null;
  }, [store.users]);

  const filterButtons: { key: Filter; label: string; count: number; icon: typeof InboxIcon; visible: boolean }[] = [
    { key: "todas", label: "Todas", count: allConversations.length, icon: InboxIcon, visible: ['admin', 'supervisor', 'recepcionista'].includes(user.role) },
    { key: "minhas", label: "Minhas", count: allConversations.filter(c => c.assignedTo === user.id).length, icon: UserCheck, visible: true },
    { key: "pendentes", label: "Pendentes", count: allConversations.filter(c => !c.assignedTo || c.status === 'novo').length, icon: Users, visible: ['admin', 'supervisor', 'recepcionista'].includes(user.role) },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground mt-4">Carregando conversas...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Mail className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Caixa de Entrada</h1>
              <p className="text-xs text-muted-foreground">{filtered.length} conversa(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleSound}
              className="h-8 w-8 p-0"
              title={soundMuted ? "Ativar som" : "Desativar som"}
            >
              {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="h-8 w-8 p-0"
              title="Atalhos de teclado"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={loading}
              className="h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${waConnected ? "bg-green-500/10 border-green-500/20" : "bg-muted/50 border-muted/20"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${waConnected ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
              <span className={`text-[10px] font-medium ${waConnected ? "text-green-500" : "text-muted-foreground"}`}>
                {waConnected ? "WhatsApp" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {showShortcuts && (
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">J</kbd>
                <span className="text-[10px] text-muted-foreground">Próxima</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">K</kbd>
                <span className="text-[10px] text-muted-foreground">Anterior</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">Enter</kbd>
                <span className="text-[10px] text-muted-foreground">Abrir</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">g</kbd>
                <span className="text-[10px] text-muted-foreground">Primeira</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">G</kbd>
                <span className="text-[10px] text-muted-foreground">Última</span>
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, mensagem ou telefone..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 h-10 text-sm" 
          />
        </div>
        {['admin', 'supervisor', 'recepcionista'].includes(user.role) && (
          <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
            {filterButtons.filter(f => f.visible).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  filter === f.key ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
                <span className="ml-1 px-1.5 py-0.5 bg-muted/80 rounded-full text-[10px]">{f.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {groupedConversations.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <InboxIcon className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa encontrada</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Experimente mudar o filtro ou buscar outro termo</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedConversations.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{group.label}</h3>
                  <span className="text-[10px] text-muted-foreground/40">{group.convs.length}</span>
                </div>
                <div className="space-y-2">
                  {group.convs.map((conv) => {
                    const assignedUser = getAssignedUser(conv.assignedTo);
                    const slaStatus = store.getSLAStatus(conv);
                    const isAtRisk = slaStatus === "em_risco" || slaStatus === "estourado";
                    const firstLetter = (conv.clientName || "?").charAt(0).toUpperCase();
                    
                    return (
                      <button
                        key={conv.id}
                        data-conversation-id={conv.id}
                        onClick={() => navigate(`/chat/${conv.id}`)}
                        className={`w-full text-left p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all active:scale-[0.99] group shadow-sm hover:shadow-md border-border/50 ${isAtRisk ? "border-l-4 border-l-destructive" : ""}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              {firstLetter}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold">{conv.clientName || "Cliente sem nome"}</p>
                              <p className="text-[11px] text-muted-foreground font-medium">{conv.clientPhone || "—"}</p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-[10px] text-muted-foreground font-medium">{formatRelativeTime(conv.lastMessageTime)}</p>
                            <div className="flex items-center gap-1 justify-end">
                              {conv.status === "novo" && (
                                <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] rounded-full font-bold uppercase tracking-wider">Novo</span>
                              )}
                              {isAtRisk && (
                                <span className="inline-block px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] rounded-full font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  SLA
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-4 border-l-2 border-primary/20">
                            {conv.lastMessage || "Sem mensagens"}
                          </p>
                        </div>
                        {assignedUser && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
                              {(assignedUser.name || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{assignedUser.name}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}