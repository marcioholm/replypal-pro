import { useState, useEffect, useRef } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";

interface Message {
  role: "user" | "ia";
  content: string;
}

export function IAChatButton({ collapsed }: { collapsed: boolean }) {
  const store = useStore();
  return (
    <button
      onClick={() => store.setIAChatOpen(!store.isIAChatOpen)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-sidebar-accent/50 text-sidebar-foreground group relative ${
        store.isIAChatOpen ? "bg-sidebar-accent/50 text-sidebar-accent-foreground" : ""
      }`}
      title="Assistente IA"
    >
      <Sparkles className="w-5 h-5 flex-shrink-0 text-sidebar-primary group-hover:scale-110 transition-transform" />
      {!collapsed && <span className="text-sm font-medium">Assistente IA</span>}
    </button>
  );
}

export function IAChatPanel() {
  const store = useStore();
  const isOpen = store.isIAChatOpen;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("Assistente IA");
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (messages.length === 0) {
        fetchTenantName();
      }
    } else {
      setMessages([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const fetchTenantName = async () => {
    if (!user?.tenantId) return;
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("nome")
        .eq("id", user.tenantId)
        .single();

      const name = data?.nome || "Empresa";
      setCompanyName(`Assistente ${name}`);
      setMessages([
        {
          role: "ia",
          content: `Olá! Sou a assistente da ${name}. Posso ajudar com informações de clientes, documentos e honorários. Como posso ajudar?`,
        },
      ]);
    } catch (err) {
      console.error("Error fetching tenant name:", err);
      setMessages([
        {
          role: "ia",
          content: `Olá! Sou a assistente IA. Posso ajudar com informações de clientes, documentos e honorários. Como posso ajudar?`,
        },
      ]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(import.meta.env.VITE_N8N_IA_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mensagem_texto: userMessage,
          numero_whatsapp: "interno",
          colaborador: user?.name || "Usuário",
          tenant_id: user?.tenantId,
          origem: "replypal_interno",
        }),
      });

      if (!response.ok) throw new Error("Falha na comunicação");

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ia", content: data.resposta || "Sem resposta." }]);
    } catch (error) {
      console.error("Error sending message to IA:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ia", content: "Não consegui processar sua solicitação. Tente novamente." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="h-screen flex flex-col bg-background border-r shadow-sm animate-in slide-in-from-left duration-300 relative z-40"
      style={{ width: "380px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sidebar-primary" />
          <h2 className="text-sm font-bold tracking-tight">✦ {companyName}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={() => store.setIAChatOpen(false)} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] px-4 py-2 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white rounded-tr-none shadow-sm"
                    : "bg-slate-100 text-slate-800 rounded-tl-none border shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 px-4 py-2 rounded-2xl rounded-tl-none border shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-muted/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Pergunte algo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="bg-background focus-visible:ring-sidebar-primary"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-sidebar-primary hover:bg-sidebar-primary/90">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
