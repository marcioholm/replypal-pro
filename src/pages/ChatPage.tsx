import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, formatTime, formatDuration, MOCK_TAGS } from "@/lib/store";
import type { ConversationStatus, ClosingReason } from "@/lib/store";
import { getNotificationConfig, setNotificationConfig } from "@/hooks/useNotifications";
import { sendWhatsAppMessage, checkConnection } from "@/lib/evolution";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { SLABadge } from "@/components/SLABadge";
import { TagBadge } from "@/components/TagBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Send, UserPlus, ArrowRightLeft, StickyNote, Tag, History, 
  CheckCircle2, Plus, Zap, MessageCircle, Clock, Paperclip, Smile, MoreHorizontal,
  FileText, Download, Printer, Copy, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";


export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();
  const { user } = useAuth();
  
  // Sincronizar usuário da Auth com a Store
  useEffect(() => {
    if (user) {
      store.setCurrentUser(user);
    }
  }, [user]);

  if (!user) return null;
  const [messageInput, setMessageInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [showPanel, setShowPanel] = useState<"customer" | "notes" | "tags" | "history" | null>("customer");
  const [transferTo, setTransferTo] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingReason, setClosingReason] = useState<ClosingReason>("resolvido");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conv = store.getConversation(id || "");
  const messages = store.getMessages(id || "");
  const notes = store.getNotes(id || "");
  const history = store.getHistory(id || "");
  const customer = store.getCustomer(conv?.customerId);

  // Fetch conversation and messages from Supabase if not found
  useEffect(() => {
    if (!id) return;

    const loadRealData = async () => {
      // Only show loading on initial load of the conversation
      if (!conv) setLoading(true);
      
      try {
        // 1. Fetch conversation if missing
        if (!conv) {
          const { data: dbConv, error: convError } = await supabase
            .from("conversas")
            .select("*")
            .eq("id", id)
            .maybeSingle();
            
          if (dbConv && !convError) {
            store.addDbConversation({
              id: dbConv.id,
              clientName: dbConv.client_name,
              clientPhone: dbConv.client_phone,
              customerId: dbConv.customer_id,
              lastMessage: dbConv.last_message,
              lastMessageTime: new Date(dbConv.last_message_time),
              status: dbConv.status as ConversationStatus,
              assignedTo: dbConv.assigned_to,
              startedAt: dbConv.started_at ? new Date(dbConv.started_at) : undefined,
              slaDeadline: dbConv.sla_deadline ? new Date(dbConv.sla_deadline) : undefined,
              tags: dbConv.tags || []
            });
          }
        }

        // 2. Fetch/Poll messages
        const { data: dbMsgs, error: msgsError } = await supabase
          .from("mensagens")
          .select("*")
          .eq("conversation_id", id)
          .order("timestamp", { ascending: true });
          
        if (dbMsgs && !msgsError) {
          store.addDbMessages(dbMsgs.map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            content: m.content,
            sender: m.sender as "client" | "agent",
            senderName: m.sender_name,
            timestamp: new Date(m.timestamp)
          })));
        }
      } catch (e) {
        console.error("Error loading chat data:", e);
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    loadRealData();

    // Fetch team members for transfer list
    const fetchTeam = async () => {
      if (!user?.tenantId) return;
      const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("tenant_id", user.tenantId);
      
      if (data) {
        store.setGlobalUsers(data.map(d => ({
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

    // Polling every 3 seconds for new messages
    const pollInterval = setInterval(loadRealData, 3000);
    
    return () => clearInterval(pollInterval);
  }, [id, !!conv]);

  if (!user) return null;


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground bg-muted/10 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-medium">Carregando conversa...</p>
          <p className="text-xs opacity-70">Buscando mensagens no servidor</p>
        </div>
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <MessageCircle className="w-8 h-8 opacity-20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Conversa não encontrada</p>
          <p className="text-xs opacity-70">Não conseguimos localizar esta conversa no banco de dados</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mt-2">
          Voltar para Início
        </Button>
      </div>
    );
  }


  const isAssigned = conv.assignedTo === user.id;
  const slaStatus = store.getSLAStatus(conv);

  const handleSend = async () => {
    if (!messageInput.trim() || !isAssigned) return;
    const qr = store.quickReplies.find((q) => messageInput.trim() === q.shortcut);
    const message = qr ? qr.content : messageInput.trim();
    
    // 1. Salvar localmente (UI imediata)
    store.sendMessage(conv.id, message, user);
    setMessageInput("");
    
    // 2. Salvar no Supabase (Persistência)
    try {
      await supabase.from("mensagens").insert({
        conversation_id: conv.id,
        content: message,
        sender: "agent",
        sender: "agent",
        sender_name: user.name,
        timestamp: new Date().toISOString()
      });
      
      // Atualizar última mensagem na conversa
      await supabase
        .from("conversas")
        .update({ 
          last_message: message,
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", conv.id);
    } catch (e) {
      console.error("Error saving message to Supabase:", e);
    }
    
    // 3. Enviar via WhatsApp (Interação real)
    const connStatus = await checkConnection();
    if (connStatus.connected) {
      const result = await sendWhatsAppMessage(conv.clientPhone, message, user.name);
      if (!result.success) {
        toast.error("Erro ao enviar WhatsApp");
      }
    }
  };

  const handleQuickReply = async (content: string) => {
    // Salvar localmente
    store.sendMessage(conv.id, content, user);
    setShowQuickReplies(false);
    
    // Salvar no Supabase
    try {
      await supabase.from("mensagens").insert({
        conversation_id: conv.id,
        content: content,
        sender: "agent",
        sender: "agent",
        sender_name: user.name,
        timestamp: new Date().toISOString()
      });
      
      await supabase
        .from("conversas")
        .update({ 
          last_message: content,
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", conv.id);
    } catch (e) {
      console.error("Error saving quick reply to Supabase:", e);
    }
    
    // Enviar via WhatsApp
    const connStatus = await checkConnection();
    if (connStatus.connected) {
      await sendWhatsAppMessage(conv.clientPhone, content, user.name);
    }
  };


  const handleAssume = async () => {
    try {
      const { error } = await supabase
        .from("conversas")
        .update({ 
          assigned_to: user.id,
          status: "em_atendimento"
        })
        .eq("id", conv.id);

      if (error) throw error;

      store.assumeConversation(conv.id, user);
      toast.success("Você assumiu este atendimento!");
    } catch (e: any) {
      console.error("Error assuming conversation:", e);
      toast.error("Erro ao assumir atendimento: " + (e.message || "Erro desconhecido"));
      return;
    }

    }
  };

  const handleTransfer = async () => {
    if (!transferTo) return;
    const targetUser = store.users.find(u => u.id === transferTo);
    if (!targetUser) return toast.error("Usuário destino não encontrado");
    
    try {
      const { error } = await supabase
        .from("conversas")
        .update({ 
          assigned_to: transferTo,
          status: conv.status === "novo" ? "em_atendimento" : conv.status
        })
        .eq("id", conv.id);

      if (error) throw error;

      store.transferConversation(conv.id, user, transferTo, transferReason);
      toast.success(`Conversa transferida para ${targetUser.name}`);
      setTransferOpen(false);
      setTransferTo("");
      setTransferReason("");
    } catch (e: any) {
      console.error("Error transferring conversation:", e);
      toast.error("Erro ao transferir: " + (e.message || "Erro desconhecido"));
      return;
    }

    }
  };

  const handleClose = () => {
    store.updateStatus(conv.id, "resolvido", user, closingReason);
    setCloseOpen(false);
  };

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    store.addNote(conv.id, noteInput.trim(), user);
    setNoteInput("");
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b bg-card/80 backdrop-blur-sm flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-9 w-9 p-0 hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
            {conv.clientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{conv.clientName}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={conv.status} />
              {conv.status !== "resolvido" && <SLABadge slaStatus={slaStatus} />}
              {customer?.priority === 'Alta' && <Badge variant="destructive" className="h-5 px-2 text-[9px] font-bold">ALTA</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAssigned && conv.status !== "resolvido" && (
              <Button size="sm" className="h-8 gap-1.5 shadow-sm" onClick={handleAssume}>
                <UserPlus className="w-3.5 h-3.5" />
                Assumir
              </Button>
            )}
            {isAssigned && conv.status !== "resolvido" && (
              <>
                {['admin', 'supervisor', 'recepcionista'].includes(user.role) && (
                  <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Transferir
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Transferir conversa</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Atendente destino</label>
                          <Select value={transferTo} onValueChange={setTransferTo}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                            <SelectContent>
                              {store.users.filter((u) => u.id !== user.id).map((u) => (
                                <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo (opcional)</label>
                          <Input placeholder="Ex: Fim do expediente" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} className="h-10" />
                        </div>
                        <Button onClick={handleTransfer} className="w-full h-10" disabled={!transferTo}>Confirmar transferência</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-success border-success/30 hover:bg-success/10">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Encerrar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold">Encerrar conversa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo do encerramento</label>
                        <Select value={closingReason} onValueChange={(v) => setClosingReason(v as ClosingReason)}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="resolvido">✓ Resolvido</SelectItem>
                            <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
                            <SelectItem value="transferido">Transferido</SelectItem>
                            <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleClose} className="w-full h-10 bg-success hover:bg-success/90">Confirmar encerramento</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4 scrollbar-thin bg-gradient-to-b from-muted/20 to-background">
          <div className="flex justify-center">
            <div className="text-center py-3 px-4 bg-card/60 rounded-full border shadow-sm">
              <p className="text-xs text-muted-foreground">
                Conversa iniciada em <span className="font-medium text-foreground">{conv.startedAt?.toLocaleDateString('pt-BR')}</span>
              </p>
            </div>
          </div>
          {messages.map((msg, idx) => (
            <div key={msg.id} className={`flex ${msg.sender === "agent" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className={`max-w-[75%] group ${msg.sender === "agent" ? "" : ""}`}>
                <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                  msg.sender === "agent" 
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md" 
                    : "bg-card border border-border/50 rounded-bl-md"
                }`}>
                  <p className={`text-[10px] font-semibold mb-1 ${msg.sender === "agent" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {msg.sender === "agent" ? msg.senderName : conv.clientName}
                  </p>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-2 flex items-center gap-1 ${msg.sender === "agent" ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
                    <Clock className="w-3 h-3" />
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
                {msg.sender === "agent" && (
                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Copiar">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-card/80 backdrop-blur-sm">
          {!isAssigned && conv.status !== "resolvido" ? (
            <div className="text-center py-4 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20">
              <p className="text-xs text-muted-foreground mb-3">Você precisa assumir a conversa para responder</p>
              <Button size="sm" className="gap-1.5 shadow-sm" onClick={handleAssume}>
                <UserPlus className="w-3.5 h-3.5" />
                Assumir conversa
              </Button>
            </div>
          ) : conv.status === "resolvido" ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 rounded-full border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-success">Conversa encerrada</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <Popover open={showQuickReplies} onOpenChange={setShowQuickReplies}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 w-10 p-0 shrink-0 hover:bg-muted">
                    <Zap className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start" side="top">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground px-2 mb-2">Respostas Rápidas</p>
                    {store.quickReplies.slice(0, 6).map((qr) => (
                      <button
                        key={qr.id}
                        onClick={() => handleQuickReply(qr.content)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors"
                      >
                        <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded mr-2">{qr.shortcut}</span>
                        {qr.content.slice(0, 40)}...
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                  className="min-h-[44px] max-h-32 resize-none pr-12 text-sm"
                  rows={1}
                />
              </div>
              <Button size="sm" className="h-10 px-4 shrink-0 shadow-md" onClick={handleSend} disabled={!messageInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-72 border-l bg-card flex flex-col hidden lg:flex shadow-2xl">
        <div className="flex border-b overflow-x-auto no-scrollbar">
          {[
            { key: "customer" as const, icon: UserPlus, label: "Cliente" },
            { key: "notes" as const, icon: StickyNote, label: "Notas" },
            { key: "tags" as const, icon: Tag, label: "Tags" },
            { key: "history" as const, icon: History, label: "Log" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setShowPanel(tab.key)}
              className={`flex-1 py-3 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 border-b-2 transition-all shrink-0 px-2 ${showPanel === tab.key ? "border-primary text-primary font-bold bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4 scrollbar-thin">
          {showPanel === "customer" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
              {customer ? (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Dados Contábeis</p>
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground tracking-tight">Regime</span>
                        <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">{customer.regime}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground tracking-tight">Prioridade</span>
                        <span className={`text-xs font-bold ${customer.priority === 'Alta' ? 'text-destructive' : customer.priority === 'Média' ? 'text-warning' : 'text-info'}`}>{customer.priority}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Responsáveis</p>
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-2">
                       <div className="flex items-center gap-2">
                         <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold italic">C</div>
                         <p className="text-xs">{store.users.find(u => u.id === customer.consultantId)?.name || 'N/A'}</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold italic">A</div>
                         <p className="text-xs">{store.users.find(u => u.id === customer.attendantId)?.name || 'N/A'}</p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Observações</p>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-lg text-xs italic text-amber-900 dark:text-amber-200">
                      {customer.observations || "Sem observações registradas."}
                    </div>
                  </div>

                  <Button variant="outline" className="w-full text-xs h-9 gap-2 group" onClick={() => navigate(`/customers/${customer.id}`)}>
                    Ver Perfil Completo
                    <Plus className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <p className="text-xs text-muted-foreground">Esta conversa não está vinculada a um cliente cadastrado.</p>
                  <Button size="sm" onClick={() => store.autoCreateCustomer(conv.clientName, conv.clientPhone)}>
                    Vincular/Criar Cliente
                  </Button>
                </div>
              )}
            </div>
          )}

          {showPanel === "notes" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Textarea placeholder="Nota interna..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} className="text-xs min-h-[60px]" />
              </div>
              <Button size="sm" className="w-full text-xs h-7" onClick={handleAddNote} disabled={!noteInput.trim()}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar nota
              </Button>
              {notes.map((n) => (
                <div key={n.id} className="p-3 rounded-lg bg-muted/50 border text-xs animate-fade-in hover:bg-muted transition-colors">
                  <p className="font-bold text-foreground mb-1">{n.authorName}</p>
                  <p className="text-muted-foreground leading-relaxed">{n.content}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-2 font-mono uppercase">{formatTime(n.timestamp)}</p>
                </div>
              ))}
            </div>
          )}

          {showPanel === "tags" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {conv.tags.map((t) => (
                  <TagBadge key={t} tagId={t} onRemove={() => store.removeTag(conv.id, t)} />
                ))}
              </div>
              <div className="border-t pt-4">
                <p className="text-[10px] text-muted-foreground mb-3 uppercase font-bold tracking-wider">Disponíveis</p>
                <div className="flex flex-wrap gap-2">
                  {MOCK_TAGS.filter((t) => !conv.tags.includes(t.id)).map((tag) => (
                    <button key={tag.id} onClick={() => store.addTag(conv.id, tag.id)} className="text-[10px] px-3 py-1 rounded-full border border-dashed hover:border-solid hover:bg-muted transition-all" style={{ borderColor: tag.color + "66", color: tag.color }}>
                      + {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showPanel === "history" && (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 text-[11px] animate-fade-in">
                  <p className="font-bold text-foreground mb-1">{h.action}</p>
                  {h.userName && <p className="text-muted-foreground opacity-80">por <span className="font-medium">{h.userName}</span></p>}
                  {h.details && <p className="text-muted-foreground italic mt-1 bg-background/50 p-1.5 rounded">{h.details}</p>}
                  <p className="text-[9px] text-muted-foreground/40 mt-2 font-mono">{formatTime(h.timestamp)}</p>
                </div>
              ))}
              {history.length === 0 && <p className="text-xs text-muted-foreground text-center py-10 opacity-50">Nenhum evento registrado</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
