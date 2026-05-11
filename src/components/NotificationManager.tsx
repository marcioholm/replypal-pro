import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Bell } from "lucide-react";
import { useSound } from "@/hooks/useSound";

export function NotificationManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { play: playNewMessage } = useSound({ soundType: "new_message", volume: 0.5 });
  const lastToastRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.tenantId) return;

    const channel = supabase
      .channel(`notifications:${user.tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `tenant_id=eq.${user.tenantId}`,
        },
        async (payload) => {
          console.log("Nova mensagem recebida via Realtime:", payload);
          const newMsg = payload.new;
          if (!newMsg || newMsg.sender === "agent") return;

          // Se estiver na página do chat dessa conversa, não notifica
          if (location.pathname === `/chat/${newMsg.conversation_id}`) return;

          // Evitar floods de notificações para a mesma conversa em pouco tempo
          const now = Date.now();
          if (lastToastRef.current[newMsg.conversation_id] && now - lastToastRef.current[newMsg.conversation_id] < 5000) {
            return;
          }
          lastToastRef.current[newMsg.conversation_id] = now;

          playNewMessage();

          // Buscar nome da conversa para o toast
          const { data: conv } = await supabase
            .from("conversas")
            .select("client_name")
            .eq("id", newMsg.conversation_id)
            .single();

          toast(conv?.client_name || "Nova Mensagem", {
            description: newMsg.content.substring(0, 60) + (newMsg.content.length > 60 ? "..." : ""),
            icon: <Bell className="w-5 h-5 text-primary" />,
            action: {
              label: "Ver Chat",
              onClick: () => navigate(`/chat/${newMsg.conversation_id}`),
            },
            duration: 8000,
          });
        }
      )
      .subscribe((status) => {
        console.log(`Status da subscrição de notificações (${user.tenantId}):`, status);
        if (status === 'CHANNEL_ERROR') {
          console.error("Erro ao conectar ao canal de notificações. Verifique se o Realtime está ativo na tabela 'mensagens'.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.tenantId, location.pathname, navigate, playNewMessage]);

  return null;
}
