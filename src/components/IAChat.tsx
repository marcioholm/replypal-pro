import { useState, useEffect, useRef } from "react";
import { Sparkles, Send, X, Loader2, Bot, User as UserIcon, ThumbsUp, ThumbsDown, BookOpen, Edit3 } from "lucide-react";
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 hover:bg-sidebar-accent/50 text-sidebar-foreground group relative mb-1 ${
        store.isIAChatOpen ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : ""
      }`}
      title="Assistente IA"
    >
      <Sparkles className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${store.isIAChatOpen ? "text-sidebar-primary-foreground" : "text-sidebar-primary group-hover:scale-110"}`} />
      {!collapsed && <span className="text-sm font-medium tracking-tight">Assistente IA</span>}
      {store.isIAChatOpen && !collapsed && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
    </button>
  );
}

export function IAChatPanel() {
  const store = useStore();
  const isOpen = store.isIAChatOpen;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user, tenant } = useAuth();
  const [companyName, setCompanyName] = useState("Assistente IA");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && tenant) {
      const name = tenant.name || "Empresa";
      setCompanyName(`Assistente ${name}`);
      setMessages([
        {
          role: "ia",
          content: `Olá! Sou a assistente da **${name}**. Estou pronta para ajudar você com informações de clientes, análise de documentos e honorários. Como posso ser útil agora?`,
        },
      ]);
    } else if (!isOpen) {
      setMessages([]);
    }
  }, [isOpen, tenant]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(import.meta.env.VITE_N8N_IA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem_texto: userMessage,
          numero_whatsapp: user?.whatsapp || user?.id || "interno",
          colaborador: user?.name || "Usuário",
          tenant_id: user?.tenantId,
          origem: "replypal_interno",
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ia", content: data.resposta || "Desculpe, não obtive uma resposta clara." }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ia", content: "Ops! Tive um problema ao processar sua mensagem. Poderia tentar novamente em alguns instantes?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const [knowledgeData, setKnowledgeData] = useState<any>(null);
  const [knowledgeFormOpen, setKnowledgeFormOpen] = useState(false);

  const saveToKnowledge = (msg: Message, userQuestion: string, correction = false) => {
    setKnowledgeData({
      titulo: userQuestion.length > 40 ? userQuestion.substring(0, 40) + "..." : userQuestion,
      conteudo: msg.content,
      origem: "conversa",
      nivel_confianca: correction ? "media" : "alta",
      status: "pendente"
    });
    setKnowledgeFormOpen(true);
  };

  const handleFeedback = async (index: number, feedback: 'positivo' | 'negativo') => {
    toast.success(`Feedback ${feedback} enviado! Obrigado por ajudar a treinar a IA.`);
    // Opcional: Salvar no Supabase se houver tabela de auditoria
  };

  if (!isOpen) return null;

  return (
    <>
    <KnowledgeForm 
      open={knowledgeFormOpen} 
      onOpenChange={setKnowledgeFormOpen} 
      onSuccess={() => toast.success("Conhecimento enviado para curadoria!")}
      editData={knowledgeData}
    />
    <div 
      className="h-screen flex flex-col bg-white border-r shadow-[10px_0_30px_-15px_rgba(0,0,0,0.1)] animate-in slide-in-from-left duration-500 ease-out relative z-40 overflow-hidden"
      style={{ width: "380px" }}
    >
      {/* Premium Header */}
      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-sidebar-primary to-sidebar-primary/80 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold leading-tight">✦ {companyName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-medium text-white/70 uppercase tracking-widest">Online Agora</span>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => store.setIAChatOpen(false)} 
          className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-6 bg-slate-50/50">
        <div className="space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                  msg.role === "user"
                    ? "bg-sidebar-primary text-white rounded-tr-none"
                    : "bg-white text-slate-700 rounded-tl-none border border-slate-200"
                }`}
              >
                {msg.content}
              </div>
              
              <div className="flex items-center justify-between w-full mt-1.5 px-1">
                <span className="text-[10px] text-slate-400">
                  {msg.role === "user" ? "Você" : companyName}
                </span>
                
                {msg.role === "ia" && i > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 border-r border-slate-200 pr-2 mr-1">
                      <button onClick={() => handleFeedback(i, 'positivo')} className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded transition-colors" title="Resposta correta">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleFeedback(i, 'negativo')} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Resposta ruim">
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => saveToKnowledge(msg, messages[i-1]?.content || "Dúvida sem título")}
                        className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-primary/10 text-primary rounded text-[9px] font-bold uppercase transition-all" 
                        title="Salvar como conhecimento oficial"
                      >
                        <BookOpen className="w-2.5 h-2.5" /> Salvar
                      </button>
                      <button 
                        onClick={() => saveToKnowledge(msg, messages[i-1]?.content || "Dúvida sem título", true)}
                        className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-orange-50 text-orange-600 rounded text-[9px] font-bold uppercase transition-all" 
                        title="Corrigir e então salvar"
                      >
                        <Edit3 className="w-2.5 h-2.5" /> Corrigir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-sidebar-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-sidebar-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-sidebar-primary/40 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-sidebar-primary/20 transition-all"
        >
          <Input
            placeholder="Digite sua dúvida aqui..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()} 
            className="bg-sidebar-primary hover:bg-sidebar-primary/90 text-white rounded-lg shadow-lg shadow-sidebar-primary/20 shrink-0 h-9 w-9 transition-transform active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
          Powered by ReplyPal Intelligence
        </p>
      </div>
    </div>
  );
}
