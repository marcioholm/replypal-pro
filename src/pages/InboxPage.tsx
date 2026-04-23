import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, formatRelativeTime } from "@/lib/store";
import { useNewMessagePolling } from "@/hooks/useNewMessagePolling";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserCheck, Users, Inbox as InboxIcon, Mail, RefreshCw } from "lucide-react";
import { checkConnection } from "@/lib/evolution";

type Filter = "todas" | "minhas" | "sem_responsavel";

export default function InboxPage() {
  const store = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const [waConnected, setWaConnected] = useState(false);
  const [waMessages, setWaMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Check WhatsApp connection on mount
  useEffect(() => {
    const check = async () => {
      const status = await checkConnection();
      setWaConnected(status.connected);
    };
    check();
  }, []);

  // Fetch messages from API periodically
  useEffect(() => {
    const fetchWA = async () => {
      try {
        const r = await fetch("/api/webhook");
        if (r.ok) {
          const d = await r.json();
          // Filter out duplicates and update state
          if (d.success && d.messages) {
            setWaMessages(d.messages);
          }
        }
      } catch (err) {
        console.error("Error polling messages:", err);
      }
    };
    
    fetchWA();
    const interval = setInterval(fetchWA, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/webhook");
      if (r.ok) {
        const d = await r.json();
        if (d.success) setWaMessages(d.messages || []);
      }
      const status = await checkConnection();
      setWaConnected(status.connected);
    } catch {}
    setLoading(false);
  };

  // Combine store conversations with unique WhatsApp messages from the webhook
  // In a real app, the webhook should update the store directly.
  const allConversations = [...store.conversations];
  
  // Add messages from waMessages if they don't already exist in store.conversations
  waMessages.forEach((m: any) => {
    const phone = m.conversas?.client_phone || m.from_num;
    const exists = allConversations.find(c => c.clientPhone === phone);
    
    if (!exists && phone) {
      allConversations.push({
        id: m.conversation_id || `wa-${m.id}`,
        clientName: m.conversas?.client_name || "WhatsApp User",
        clientPhone: phone,
        lastMessage: m.content || m.message,
        lastMessageTime: new Date(m.timestamp || m.created_at),
        status: "novo",
        tags: []
      });
    }
  });

  useNewMessagePolling(
    allConversations,
    store.currentUser.id,
    store.currentUser.role || "atendente"
  );

  const filtered = allConversations
    .filter((c) => {
      if (filter === "minhas") return c.assignedTo === store.currentUser.id;
      if (filter === "sem_responsavel") return !c.assignedTo;
      return true;
    })
    .filter((c) => {
      if (!search) return true;
      return (
        c.clientName.toLowerCase().includes(search.toLowerCase()) || 
        c.lastMessage.toLowerCase().includes(search.toLowerCase()) ||
        c.clientPhone.includes(search)
      );
    })
    .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

  const filterButtons: { key: Filter; label: string; count: number; icon: typeof InboxIcon }[] = [
    { key: "todas", label: "Todas", count: allConversations.length, icon: InboxIcon },
    { key: "minhas", label: "Minhas", count: allConversations.filter(c => c.assignedTo === store.currentUser.id).length, icon: UserCheck },
    { key: "sem_responsavel", label: "Pendentes", count: allConversations.filter(c => !c.assignedTo).length, icon: Users },
  ];

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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, mensagem ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 text-sm" />
        </div>
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
          {filterButtons.map((f) => (
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
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <InboxIcon className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa encontrada</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Experimente mudar o filtro ou buscar outro termo</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full text-left p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all active:scale-[0.99] group shadow-sm hover:shadow-md border-border/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {conv.clientName.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{conv.clientName}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{conv.clientPhone}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium">{formatRelativeTime(conv.lastMessageTime)}</p>
                  {conv.status === "novo" && (
                    <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] rounded-full font-bold uppercase tracking-wider">Novo</span>
                  )}
                </div>
              </div>
              <div className="mt-3 relative">
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-4 border-l-2 border-primary/20">
                  {conv.lastMessage}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}