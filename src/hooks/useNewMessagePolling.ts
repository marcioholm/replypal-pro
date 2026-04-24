import { useEffect, useRef, useCallback } from "react";
import { getNotificationConfig } from "./useNotifications";

const POLL_INTERVAL = 15000;

export function useNewMessagePolling(
  conversations: { id: string; clientName: string; lastMessage: string; lastMessageTime: Date; assignedTo?: string }[],
  currentUserId: string,
  currentUserRole: string
) {
  const lastMessageTimes = useRef<Record<string, number>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNewMessages = useCallback(() => {
    const config = getNotificationConfig();
    if (!config.enabled || !config.notifyNewConversations) return;

    conversations.forEach((conv) => {
      const lastTime = conv.lastMessageTime?.getTime ? conv.lastMessageTime.getTime() : 0;
      const prevTime = lastMessageTimes.current[conv.id] || 0;

      if (lastTime > prevTime && prevTime > 0) {
        const shouldNotify =
          config.notifyTarget === "all" ||
          (config.notifyTarget === "manager" && (currentUserRole === "admin" || currentUserRole === "supervisor" || currentUserRole === "recepcionista")) ||
          (config.notifyTarget === "responsible" && conv.assignedTo === currentUserId);

        if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
          new Notification("Nova mensagem de " + conv.clientName, {
            body: conv.lastMessage.substring(0, 100),
            icon: "/favicon.ico",
            tag: conv.id,
          });
        }
      }

      lastMessageTimes.current[conv.id] = lastTime || Date.now();
    });
  }, [conversations, currentUserId, currentUserRole]);

  useEffect(() => {
    conversations.forEach((conv) => {
      const lastTime = conv.lastMessageTime?.getTime ? conv.lastMessageTime.getTime() : 0;
      if (!lastMessageTimes.current[conv.id]) {
        lastMessageTimes.current[conv.id] = lastTime || Date.now();
      }
    });
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(checkNewMessages, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkNewMessages]);
}