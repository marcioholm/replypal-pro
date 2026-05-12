import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { sendWhatsAppMessage } from "@/lib/evolution";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !message || !user) return;

    setLoading(true);
    const toastId = toast.loading("Iniciando conversa...");

    try {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) throw new Error("Telefone inválido");

      // 1. Enviar mensagem via Evolution
      const res = await sendWhatsAppMessage(cleanPhone, message, user.name);
      if (!res.success) throw new Error(res.error || "Erro ao enviar mensagem");

      const extId = res.data?.key?.id;

      // 2. Criar ou encontrar conversa no Supabase
      let { data: conv, error: fetchError } = await supabase
        .from("conversas")
        .select("*")
        .eq("client_phone", cleanPhone)
        .eq("tenant_id", user.tenantId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!conv) {
        const { data: newConv, error: createError } = await supabase
          .from("conversas")
          .insert({
            client_name: cleanPhone,
            client_phone: cleanPhone,
            last_message: message,
            last_message_time: new Date().toISOString(),
            status: "em_atendimento",
            assigned_to: user.id,
            tenant_id: user.tenantId
          })
          .select()
          .single();

        if (createError) throw createError;
        conv = newConv;
      } else {
        // Atualizar conversa existente
        await supabase
          .from("conversas")
          .update({
            last_message: message,
            last_message_time: new Date().toISOString(),
            status: "em_atendimento",
            assigned_to: user.id
          })
          .eq("id", conv.id);
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
      <DialogContent className="sm:max-w-[425px] rounded-[32px] border-border/40 backdrop-blur-xl bg-card/95">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Iniciar Nova Conversa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleStartChat} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">WhatsApp do Cliente</Label>
            <Input
              id="phone"
              placeholder="Ex: 5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 bg-muted/50 border-border/40 rounded-2xl focus:ring-primary/20"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Primeira Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Olá, como posso ajudar?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] bg-muted/50 border-border/40 rounded-2xl focus:ring-primary/20 resize-none"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 gap-2 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/10"
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
      </DialogContent>
    </Dialog>
  );
}
