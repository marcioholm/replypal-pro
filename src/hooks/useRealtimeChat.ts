import { useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useStore } from "../lib/store";

interface UseRealtimeOptions {
  tenantId?: string;
  userId?: string;
  enabled?: boolean;
  notify?: (title: string, body: string, type: "new" | "assigned", conversationId?: string) => void;
}

export function useRealtimeChat({ tenantId, userId, enabled = true, notify }: UseRealtimeOptions) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribeToConversas = useCallback(() => {
    if (!enabled || !tenantId) return;

    // Já está conectado?
    if (channelRef.current) {
      return channelRef.current;
    }

    const channel = supabase
      .channel(`chat:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversas",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === "INSERT" && newRecord) {
            import("./useSound").then(({ playNotificationSound }) => {
              playNotificationSound({ type: "new_conversation" });
            });

            if (notify) {
              notify("Nova Conversa", `${newRecord.client_name} iniciou um chat`, "new", newRecord.id);
            }

            storeRef.current.addDbConversation({
              id: newRecord.id,
              clientName: newRecord.client_name,
              clientPhone: newRecord.client_phone,
              customerId: newRecord.customer_id,
              lastMessage: newRecord.last_message,
              lastMessageTime: new Date(newRecord.last_message_time),
              status: newRecord.status,
              assignedTo: newRecord.assigned_to,
              startedAt: newRecord.started_at ? new Date(newRecord.started_at) : undefined,
              slaDeadline: newRecord.sla_deadline ? new Date(newRecord.sla_deadline) : undefined,
              tenantId: newRecord.tenant_id,
              isTyping: newRecord.is_typing,
            });
          } else if (eventType === "UPDATE" && newRecord) {
            // Se mudou para mim, notificar
            if (newRecord.assigned_to === userId && oldRecord?.assigned_to !== userId && notify) {
              notify("Conversa Atribuída", `Você agora é o responsável por ${newRecord.client_name}`, "assigned", newRecord.id);
            }
            storeRef.current.addDbConversation({
              id: newRecord.id,
              clientName: newRecord.client_name,
              clientPhone: newRecord.client_phone,
              customerId: newRecord.customer_id,
              lastMessage: newRecord.last_message,
              lastMessageTime: new Date(newRecord.last_message_time),
              status: newRecord.status,
              assignedTo: newRecord.assigned_to,
              startedAt: newRecord.started_at ? new Date(newRecord.started_at) : undefined,
              slaDeadline: newRecord.sla_deadline ? new Date(newRecord.sla_deadline) : undefined,
              tenantId: newRecord.tenant_id,
              isTyping: newRecord.is_typing,
            });
          } else if (eventType === "DELETE" && oldRecord) {
            // Remover conversa
            console.log("Conversation deleted:", oldRecord.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          // Sem filtro direto de tenant_id aqui — filtrar no handler
        },
        (payload) => {
          const { new: newRecord } = payload;
          if (!newRecord) return;
          
          // IMPLEMENTAÇÃO 9: Filtrar só mensagens de conversas que o store conhece
          const knownConv = storeRef.current.conversations.find(
            c => c.id === newRecord.conversation_id
          );
          if (!knownConv) return; // Ignora mensagens de outros tenants
          
          // Tocar som se a mensagem não for do próprio atendente
          if (newRecord.sender === "client") {
            import("./useSound").then(({ playNotificationSound }) => {
              playNotificationSound({ type: "new_message" });
            });

            if (notify) {
              const body = newRecord.type === "text" ? newRecord.content : `Nova mídia: ${newRecord.type}`;
              notify(newRecord.sender_name || "Cliente", body, "assigned", newRecord.conversation_id);
            }
          }

          storeRef.current.addDbMessages([
            {
              id: newRecord.id,
              conversationId: newRecord.conversation_id,
              content: newRecord.content,
              sender: newRecord.sender as "client" | "agent",
              senderName: newRecord.sender_name || "",
              timestamp: new Date(newRecord.timestamp),
              type: newRecord.type,
              mediaUrl: newRecord.media_url,
              status: newRecord.status,
              fileName: newRecord.file_name,
              mimeType: newRecord.mime_type,
              fileSize: newRecord.file_size,
              durationSeconds: newRecord.duration_seconds,
              external_message_id: newRecord.external_message_id,
              reaction: newRecord.reaction,
            },
          ]);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return channel;
  }, [tenantId, enabled]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Automatic subscription
  useEffect(() => {
    if (enabled && tenantId && tenantId.length >= 5) {
      subscribeToConversas();
    }
    return () => {
      unsubscribe();
    };
  }, [enabled, tenantId, subscribeToConversas, unsubscribe]);

  return {
    subscribe: subscribeToConversas,
    unsubscribe,
    isConnected: !!channelRef.current,
  };
}

export default useRealtimeChat;