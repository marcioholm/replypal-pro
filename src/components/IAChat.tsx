import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, Send, X, Loader2, Bot, User as UserIcon, ThumbsUp, ThumbsDown, BookOpen, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import KnowledgeForm from "@/components/training/KnowledgeForm";

interface Message {
  role: "user" | "ia";
  content: string;
}

export function IAChatButton({ collapsed }: { collapsed: boolean }) {
  const store = useStore();
  return (
    <button
      onClick={() => store.setIAChatOpen(!store.isIAChatOpen)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-all duration-300 group relative mb-1 ${
        store.isIAChatOpen 
          ? "bg-[rgba(34,199,169,0.2)] text-[#22C7A9]" 
          : "hover:bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.65)] hover:text-white"
      }`}
      title="Operai - Assistente IA"
    >
      <img 
        src="/operai-icon.png" 
        alt="Operai" 
        className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 ${store.isIAChatOpen ? "scale-110" : "opacity-70 group-hover:opacity-100 group-hover:scale-110"}`} 
      />
      <span className={`text-sm font-medium tracking-tight whitespace-nowrap transition-all duration-300 overflow-hidden ${
        collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
      }`}>
        Operai
      </span>
      {store.isIAChatOpen && !collapsed && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[#22C7A9] animate-pulse" />}
    </button>
  );
}

export function IAChatPanel() {
  const store = useStore();
  const location = useLocation();
  const isOpen = store.isIAChatOpen;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user, tenant } = useAuth();
  const [companyName, setCompanyName] = useState("Operai");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detectar se está na página de um cliente para enviar cliente_id
  const pathParts = location.pathname.split("/");
  const clienteId = (pathParts[1] === "customers" && pathParts[2]) ? pathParts[2] : undefined;

  useEffect(() => {
    const loadHistory = async () => {
      if (isOpen && tenant && user) {
        setCompanyName(`Operai | ${tenant.name || "IA"}`);
        
        try {
          // Carregar histórico do Supabase
          const { data, error } = await supabase
            .from("historico_ia")
            .select("*")
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(50);

          if (error) throw error;

          if (data && data.length > 0) {
            setMessages(data.map(m => ({
              role: m.role as "user" | "ia",
              content: m.content
            })));
          } else {
            // Mensagem inicial se não houver histórico
            setMessages([
              {
                role: "ia",
                content: `Olá! Sou a **Operai**, assistente inteligente da **${tenant.name || 'sua empresa'}**. Como posso ajudar você hoje?`,
              },
            ]);
          }
        } catch (err) {
          console.error("Erro ao carregar histórico da IA:", err);
          // Fallback para mensagem inicial
          setMessages([
            {
              role: "ia",
              content: `Olá! Sou a **Operai**. Como posso ajudar você hoje?`,
            },
          ]);
        }
      }
    };

    loadHistory();
  }, [isOpen, tenant, user]);

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

    const payload = {
      mensagem_texto: userMessage,
      tenant_id: tenant?.id || user?.tenantId || "11111111-1111-1111-1111-111111111111",
      cliente_id: clienteId || null,
      origem: "replypal_interno",
      numero_whatsapp: user?.whatsapp || "interno",
      colaborador: user?.name || "Usuário ReplyPal",
    };

    console.log("Payload IA enviado:", payload);

    try {
      const response = await fetch("https://northway.vps8204.panel.icontainer.cloud/webhook/replypal/ia-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      console.log("Resposta IA recebida:", data);

      // Suporte para resposta direta ou dentro de array (padrão n8n)
      const resData = Array.isArray(data) ? data[0] : data;

      // Prioridade: resposta > resposta_final > message
      const message =
        resData?.resposta ||
        resData?.resposta_final ||
        resData?.message ||
        "Não foi possível obter resposta da IA.";

      // Formatar quebras de linha e limpar espaços extras
      const textoIA = String(message).replace(/\\n/g, '\n').trim();

      setMessages((prev) => [...prev, { role: "ia", content: textoIA }]);

      // Salvar histórico no Supabase
      if (tenant && user) {
        await supabase.from("historico_ia").insert([
          {
            tenant_id: tenant.id,
            user_id: user.id,
            role: "user",
            content: userMessage,
            cliente_id: clienteId || null
          },
          {
            tenant_id: tenant.id,
            user_id: user.id,
            role: "ia",
            content: textoIA,
            cliente_id: clienteId || null
          }
        ]);
      }
    } catch (error) {
      console.error("IA Assistant Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ia", content: "Não foi possível obter resposta da IA. Verifique sua conexão ou tente novamente." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = (content: string) => {
    // Regex para detectar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-500 hover:text-blue-600 underline font-medium break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const [knowledgeData, setKnowledgeData] = useState<any>(null);
  const [knowledgeFormOpen, setKnowledgeFormOpen] = useState(false);

  const saveToKnowledge = (msg: Message, userQuestion: string, correction = false) => {
    setKnowledgeData({
      titulo: userQuestion.length > 40 ? userQuestion.substring(0, 40) + "..." : userQuestion,
      conteudo: msg.content,
      categoria: "Atendimento", // Categoria padrão para evitar erro de validação
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
      className="h-screen sticky top-0 flex flex-col bg-white border-r shadow-xl animate-in slide-in-from-left duration-500 ease-out z-40 overflow-hidden shrink-0"
      style={{ width: "380px" }}
    >
      {/* Premium Header */}
      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-sidebar-primary to-sidebar-primary/80 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center shadow-inner">
            <img src="/operai-icon.png" alt="Operai" className="w-full h-full object-contain" />
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
                <div className="whitespace-pre-line">
                  {renderContent(msg.content)}
                </div>
              </div>
              
              <div className="flex items-center justify-between w-full mt-1.5 px-1">
                <div className="flex items-center gap-2">
                  {msg.role === "ia" && (
                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                      <img src="/operai-icon.png" alt="O" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium">
                    {msg.role === "user" ? "Você" : companyName}
                  </span>
                </div>
                
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
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400 text-slate-900"
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
    </>
  );
}
