import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, formatRelativeTime } from "@/lib/store";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useListKeyboardNav } from "@/hooks/useListNavigation";
import { useSound } from "@/hooks/useSound";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserCheck, Users, Inbox as InboxIcon, Mail, RefreshCw, AlertTriangle, Clock, Volume2, VolumeX, Keyboard, UserPlus } from "lucide-react";
import { checkConnection } from "@/lib/evolution";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useNotification } from "@/hooks/useNotifications";
import { toast } from "sonner";

type Filter = "todas" | "minhas" | "pendentes" | "fila";

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
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [prevConversationCount, setPrevConversationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showSidebar, setShowSidebar] = useState(() => {
    const saved = localStorage.getItem("replypal_show_sidebar");
    return saved !== null ? saved === "true" : true;
  });
  const conversationsRef = useRef<{ id: string }[]>([]);

  const toggleSidebar = () => {
    setShowSidebar(prev => {
      const next = !prev;
      localStorage.setItem("replypal_show_sidebar", String(next));
      return next;
    });
  };

  // 1. Helpers e FetchData
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ReplyPal Pro`;
    } else {
      document.title = "ReplyPal Pro";
    }
  }, [unreadCounts]);

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
      } else if (filter === "fila") {
        query = query.is("assigned_to", null).neq("status", "resolvido");
      }

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
          clientAvatar: c.client_avatar
        }));
        storeRef.current.addDbConversations(formattedConvs);
      }
    } catch (err) {
      console.error("Erro na busca de conversas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId, user?.id, filter]);

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
            clientAvatar: c.client_avatar
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

  // IMPLEMENTAÇÃO 1.2: Filtro padrão para atendentes = "pendentes"
  useEffect(() => {
    if (user && !hasSetDefaultFilter) {
      if (['admin', 'supervisor'].includes(user.role)) {
        setFilter("todas");
      } else {
        // Atendentes começam em "Pendentes" para ver o que precisam assumir
        setFilter("pendentes");
      }
      setHasSetDefaultFilter(true);
    }
  }, [user, hasSetDefaultFilter]);

  useEffect(() => {
    const check = async () => {
      try {
        const status = await checkConnection();
        setWaConnected(status.connected);
      } catch (err) {
        setWaConnected(false);
      }
    };
    check();

    // Solicitar permissão de notificação
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
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

  // useEffect separado para quando o FILTRO muda (sem criar novo canal)
  useEffect(() => {
    if (user?.tenantId) {
      fetchData();
    }
  }, [filter, fetchData]);

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
      
      await supabase.from('historico').insert({
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

  const filtered = useMemo(() => {
    let convs = allConversations.filter(c => {
      if (filter === "minhas") return c.assignedTo === user?.id;
      if (filter === "pendentes") return !c.assignedTo || c.status === "novo";
      if (filter === "fila") return !c.assignedTo && c.status !== "resolvido";
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
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });

    return convs;
  }, [allConversations, filter, user?.id, search, store]);

  // Contagens para as abas
  const counts = useMemo(() => {
    return {
      minhas: allConversations.filter(c => c.assignedTo === user?.id && c.status !== 'resolvido').length,
      todas: allConversations.filter(c => c.status !== 'resolvido').length,
      pendentes: allConversations.filter(c => (!c.assignedTo || c.status === 'novo' || c.status === 'aguardando') && c.status !== 'resolvido').length,
      fila: allConversations.filter(c => !c.assignedTo && c.status !== 'resolvido').length
    };
  }, [allConversations, user?.id]);

  const filaCount = counts.fila;

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
    () => setShowShortcuts(true)
  );

  if (!user) return null;

  return (
    <div className="flex h-full bg-slate-50/30 dark:bg-[#010809]/30">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border/40">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-white/40 dark:bg-[#021B1A]/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <InboxIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Caixa de Entrada</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {filtered.length} conversas encontradas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleManualRefresh}
              className={cn("h-9 w-9 rounded-xl", loading && "animate-spin")}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn("h-9 w-9 rounded-xl", !showSidebar && "bg-primary/10 text-primary")}
            >
              <Keyboard className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              className="h-9 w-9 rounded-xl"
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-destructive" /> : <Volume2 className="w-4 h-4 text-primary" />}
            </Button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Buscar por nome, mensagem ou telefone..."
              className="pl-10 h-11 bg-white/50 dark:bg-[#021B1A]/50 border-border/40 rounded-xl focus:ring-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-border/20">
              <button
                onClick={() => setFilter("minhas")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                  filter === "minhas" ? "bg-white dark:bg-primary text-primary dark:text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Minhas
                {counts.minhas > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">
                    {counts.minhas}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilter("todas")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                  filter === "todas" ? "bg-white dark:bg-primary text-primary dark:text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Todas
                {counts.todas > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] rounded-full">
                    {counts.todas}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilter("pendentes")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                  filter === "pendentes" ? "bg-white dark:bg-primary text-primary dark:text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                Pendentes
                {counts.pendentes > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] rounded-full">
                    {counts.pendentes}
                  </span>
                )}
              </button>
              {['admin', 'supervisor'].includes(user.role) && (
                <button
                  onClick={() => setFilter("fila")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                    filter === "fila" ? "bg-white dark:bg-primary text-primary dark:text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  Fila
                  {counts.fila > 0 && (
                    <span className="ml-1 w-4 h-4 bg-destructive text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {counts.fila}
                    </span>
                  )}
                </button>
              )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-muted-foreground animate-pulse">Carregando conversas...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                <Mail className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Nenhuma conversa encontrada</p>
                <p className="text-xs text-muted-foreground">Tente mudar o filtro ou termo de busca</p>
              </div>
            </div>
          ) : (
            filtered.map((conv) => {
              const slaStatus = store.getSLAStatus(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className="w-full group relative flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#021B1A]/40 border border-border/40 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all text-left"
                >
                  {/* Badge de não lidas */}
                  {(unreadCounts[conv.id] || 0) > 0 && (
                    <span className="absolute top-3 right-3 min-w-5 h-5 bg-primary text-primary-foreground text-[9px] font-black rounded-full flex items-center justify-center px-1">
                      {unreadCounts[conv.id] > 99 ? '99+' : unreadCounts[conv.id]}
                    </span>
                  )}

                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black overflow-hidden">
                      {conv.clientAvatar ? (
                        <img 
                          src={conv.clientAvatar} 
                          alt={conv.clientName} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : conv.isGroup ? (
                        <Users className="w-6 h-6" />
                      ) : (
                        conv.clientName.charAt(0)
                      )}
                    </div>
                    {conv.status === "novo" && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary border-2 border-white dark:border-[#021B1A] rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-foreground truncate">{conv.clientName}</span>
                      <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(conv.lastMessageTime)}
                      </span>
                    </div>
                    {conv.isTyping ? (
                      <p className="text-xs text-primary font-bold animate-pulse flex items-center gap-1">
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                        digitando...
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate line-clamp-1 italic">
                        {conv.lastMessage || "Sem mensagens"}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                        "bg-primary/10 text-primary border border-primary/20"
                      )}>
                        {conv.status}
                      </span>
                      {slaStatus !== "ok" && (
                        <span className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse",
                          slaStatus === "estourado" ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-warning/10 text-warning border border-warning/20"
                        )}>
                          <AlertTriangle className="w-2.5 h-2.5" />
                          SLA {slaStatus === "estourado" ? "Estourado" : "Em Risco"}
                        </span>
                      )}
                    </div>

                    {/* Mostrar quem está atendendo quando já tem responsável */}
                    {conv.assignedTo && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1 mt-1">
                        <UserCheck className="w-2.5 h-2.5" />
                        {store.users.find(u => u.id === conv.assignedTo)?.name || 'Atribuído'}
                      </span>
                    )}
                  </div>

                  {/* IMPLEMENTAÇÃO: Atribuição rápida / Aceitar */}
                  <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                    {!conv.assignedTo && (
                      <Button 
                        size="sm" 
                        className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-wider shadow-lg shadow-primary/20 animate-pulse"
                        onClick={() => handleQuickAssign(conv.id, user.id)}
                      >
                        Aceitar
                      </Button>
                    )}

                    {['admin', 'supervisor'].includes(user.role) && !conv.assignedTo && (
                      <Select onValueChange={(uid) => handleQuickAssign(conv.id, uid)}>
                        <SelectTrigger className="h-7 text-[10px] border-dashed bg-transparent">
                          <span className="flex items-center gap-1">
                            <UserPlus className="w-3 h-3" />
                            Delegar
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {store.users
                            .filter(u => ['atendente', 'supervisor'].includes(u.role))
                            .map(u => (
                              <SelectItem key={u.id} value={u.id} className="text-xs">
                                {u.name}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {!waConnected && (
          <div className="m-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">WhatsApp Desconectado</p>
              <p className="text-xs text-destructive/70">As mensagens não serão enviadas ou recebidas.</p>
            </div>
            <Button size="sm" variant="outline" className="bg-white border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => navigate("/settings")}>
              Conectar
            </Button>
          </div>
        )}
      </div>

      {showSidebar && (
        <div className="hidden xl:flex w-80 bg-white/40 dark:bg-[#021B1A]/40 backdrop-blur-md flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-border/40">
          <h3 className="font-bold text-foreground">Acesso Rápido</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Atalhos do teclado</p>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Abrir Ajuda</span>
              <kbd className="px-2 py-1 rounded bg-white dark:bg-[#021B1A] border border-border/50 text-[10px] font-black shadow-sm">?</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Navegar</span>
              <div className="flex gap-1">
                <kbd className="px-2 py-1 rounded bg-white dark:bg-[#021B1A] border border-border/50 text-[10px] font-black shadow-sm">↑</kbd>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-[#021B1A] border border-border/50 text-[10px] font-black shadow-sm">↓</kbd>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Selecionar</span>
              <kbd className="px-2 py-1 rounded bg-white dark:bg-[#021B1A] border border-border/50 text-[10px] font-black shadow-sm">ENTER</kbd>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Keyboard className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary">Modo Agente</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
              Use as setas do teclado para alternar entre conversas rapidamente e <span className="font-bold text-primary">Enter</span> para abrir o chat.
            </p>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}