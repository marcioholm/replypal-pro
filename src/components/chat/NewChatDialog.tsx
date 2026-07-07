import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, Loader2, Search, User, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { sendWhatsAppMessage } from "@/lib/evolution";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn, getBrazilianPhoneVariations } from "@/lib/utils";

interface NewChatDialogProps {
  collapsed?: boolean;
}

export function NewChatDialog({ collapsed }: NewChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const [isExternal, setIsExternal] = useState(false);

  // Contact list state
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenExternal = (e: any) => {
      if (e.detail?.phone) {
        setPhone(e.detail.phone);
        setOpen(true);
        setIsExternal(true);
      }
    };
    window.addEventListener("open-new-chat", handleOpenExternal);
    return () => window.removeEventListener("open-new-chat", handleOpenExternal);
  }, []);

  // Fetch contacts on modal open
  useEffect(() => {
    if (!open || !user) return;
    
    const loadContacts = async () => {
      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("id, responsavel, nome_fantasia, whatsapp, cnpj")
          .eq("tenant_id", user.tenantId)
          .order("responsavel", { ascending: true });
        
        if (error) throw error;
        setContacts(data || []);
      } catch (err) {
        console.error("Erro ao carregar contatos:", err);
      }
    };
    
    loadContacts();
    setSelectedContactId(null);
    setSearchQuery("");
  }, [open, user]);

  const filteredContacts = contacts.filter(c => {
    const term = searchQuery.toLowerCase();
    const resp = (c.responsavel || "").toLowerCase();
    const fant = (c.nome_fantasia || "").toLowerCase();
    const cn = (c.cnpj || "").toLowerCase();
    const tel = (c.whatsapp || "").replace(/\D/g, "");
    return resp.includes(term) || fant.includes(term) || cn.includes(term) || tel.includes(term);
  });

  const handleSelectContact = (c: any) => {
    setSelectedContactId(c.id);
    const cleanPhone = (c.whatsapp || "").replace(/\D/g, "");
    setPhone(cleanPhone);
  };

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !message || !user) return;

    setLoading(true);
    const toastId = toast.loading("Iniciando conversa...");

    try {
      const cleanPhone = String(phone || "").replace(/\D/g, "");
      if (cleanPhone.length < 10) throw new Error("Telefone inválido");

      // 1. Enviar mensagem via Evolution
      const res = await sendWhatsAppMessage(cleanPhone, message, user.name);
      if (!res.success) throw new Error(res.error || "Erro ao enviar mensagem");

      const extId = res.data?.key?.id;

      // 2. Criar ou encontrar conversa no Supabase usando variações do telefone
      const variations = getBrazilianPhoneVariations(cleanPhone);
      let { data: conv, error: fetchError } = await supabase
        .from("conversas")
        .select("*")
        .in("client_phone", variations)
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Se selecionamos um contato, obter o ID do cliente
      const matchedCustomer = contacts.find(c => c.id === selectedContactId) || 
                             contacts.find(c => {
                               const cleanCust = (c.whatsapp || "").replace(/\D/g, "");
                               return variations.includes(cleanCust);
                             });

      const normalizedPhone = cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone;

      if (!conv) {
        // Gerar protocolo único
        let protocolo = null;
        const { data: protoResult } = await supabase
          .rpc('get_next_protocolo', { p_tenant_id: user.tenantId })
          .single();
        if (protoResult) protocolo = protoResult;

        const { data: newConv, error: createError } = await supabase
          .from("conversas")
          .insert({
            client_name: matchedCustomer?.responsavel || matchedCustomer?.nome_fantasia || cleanPhone,
            client_phone: normalizedPhone,
            customer_id: matchedCustomer?.id || null,
            last_message: message,
            last_message_time: new Date().toISOString(),
            status: "em_atendimento",
            assigned_to: user.id,
            tenant_id: user.tenantId,
            protocolo: protocolo
          })
          .select()
          .single();

        if (createError) throw createError;
        conv = newConv;

        // Log de criação com protocolo
        if (protocolo) {
          await supabase.from("historico").insert({
            conversation_id: conv.id,
            action: "Chamado criado",
            details: `Protocolo: #${protocolo}`,
            user_id: user.id,
            user_name: user.name
          });
        }
      } else {
        // Atualizar conversa existente
        const { error: updateError } = await supabase
          .from("conversas")
          .update({
            last_message: message,
            last_message_time: new Date().toISOString(),
            status: "em_atendimento",
            assigned_to: user.id,
            customer_id: matchedCustomer?.id || conv.customer_id || null
          })
          .eq("id", conv.id);
          
        if (updateError) throw updateError;
      }

      // 3. Inserir mensagem no banco
      await supabase.from("mensagens").insert({
        conversation_id: conv.id,
        content: message,
        sender: "agent",
        sender_name: user.name,
        type: "text",
        external_message_id: extId,
        status: "sent",
        tenant_id: user.tenantId
      });

      // 4. Adicionar ao histórico
      await supabase.from("historico").insert({
        conversation_id: conv.id,
        action: "Nova conversa iniciada pelo agente",
        user_id: user.id,
        user_name: user.name
      });

      toast.success("Conversa iniciada!", { id: toastId });
      setOpen(false);
      setPhone("");
      setMessage("");
      
      // Navegar para o chat
      navigate(`/chat/${conv.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar conversa", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {collapsed ? (
          <Button variant="primary" size="icon" className="w-12 h-12 rounded-2xl shadow-lg shadow-primary/20">
            <Plus className="w-6 h-6" />
          </Button>
        ) : (
          <Button className="w-full h-12 gap-3 rounded-2xl shadow-lg shadow-primary/20 font-bold text-sm">
            <Plus className="w-5 h-5" />
            Nova Conversa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[850px] w-[95vw] rounded-[32px] border-border/40 backdrop-blur-xl bg-card/95 p-6 gap-0">
        <DialogHeader className="pb-4 border-b border-border/20">
          <DialogTitle className="text-xl font-black">Iniciar Nova Conversa</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-6">
          {/* Left Column: Contact List */}
          <div className="md:col-span-5 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-border/20 pb-6 md:pb-0 md:pr-6">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Buscar Contato
              </Label>
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Nome, empresa, CNPJ ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/40 border-border/20 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[150px] max-h-[350px]">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1 mb-2">
                Lista de Contatos ({filteredContacts.length})
              </Label>
              
              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {filteredContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/10 rounded-2xl border border-dashed border-border/20">
                    <User className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">Nenhum contato encontrado</p>
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = selectedContactId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectContact(c)}
                        className={cn(
                          "flex flex-col gap-1 p-3 rounded-xl border border-border/10 cursor-pointer transition-all hover:bg-muted/40",
                          isSelected 
                            ? "bg-primary/5 border-primary shadow-sm" 
                            : "bg-muted/10"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-foreground truncate flex-1">
                            {c.responsavel || "Sem nome"}
                          </h4>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>
                        {c.nome_fantasia && (
                          <p className="text-xs text-muted-foreground font-medium truncate">
                            {c.nome_fantasia}
                          </p>
                        )}
                        <p className="text-[11px] text-primary/80 font-bold tracking-wide mt-0.5">
                          {c.whatsapp}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Message Form */}
          <form onSubmit={handleStartChat} className="md:col-span-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                WhatsApp do Cliente
              </Label>
              <Input
                id="phone"
                placeholder="Ex: 5511999999999"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSelectedContactId(null); // Clear list selection if manually modified
                }}
                className="h-11 bg-muted/40 border-border/20 rounded-xl focus:ring-primary/20"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Primeira Mensagem
              </Label>
              <Textarea
                id="message"
                placeholder="Olá, como posso ajudar?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[140px] bg-muted/40 border-border/20 rounded-xl focus:ring-primary/20 resize-none text-sm"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 gap-2 rounded-xl font-bold text-sm uppercase tracking-widest shadow-xl shadow-primary/10 mt-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar e Iniciar
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
