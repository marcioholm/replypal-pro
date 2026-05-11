import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NotificationTarget = "all" | "responsible" | "manager";

export interface NotificationConfig {
  notifyNewConversations: boolean;
  notifyAssignedMessages: boolean;
  notifyTarget: NotificationTarget;
  enabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
  notifyNewConversations: true,
  notifyAssignedMessages: true,
  notifyTarget: "manager",
  enabled: true,
};

const CONFIG_KEY = "replypal_notifications_config";

function getNotificationConfig(): NotificationConfig {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

function setNotificationConfig(config: NotificationConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

interface NotificationContextType {
  config: NotificationConfig;
  updateConfig: (config: Partial<NotificationConfig>) => void;
  notify: (title: string, body: string, type: "new" | "assigned", conversationId?: string, assignedTo?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children, currentUser, userRole }: { children: ReactNode; currentUser: { id: string; name: string; role: string }; userRole: string }) {
  const [config, setConfig] = useState<NotificationConfig>(getNotificationConfig);
  const navigate = useNavigate();

  const updateConfig = useCallback((newConfig: Partial<NotificationConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      setNotificationConfig(updated);
      return updated;
    });
  }, []);

  const notify = useCallback((title: string, body: string, type: "new" | "assigned", conversationId?: string, assignedTo?: string) => {
    if (!config.enabled) return;

    // Lógica de Cargo:
    // 1. Admin e Recepcionista veem TUDO por padrão
    // 2. Outros cargos só veem se for "novo" ou se estiverem atribuídos a eles
    const isManagerOrReceptionist = ["admin", "recepcionista"].includes(userRole);
    const isMine = assignedTo === currentUser.id;

    if (!isManagerOrReceptionist && !isMine && type !== "new") {
      return; // Ignora se não for pra mim e eu não for admin/recepção
    }

    if (type === "new" && !config.notifyNewConversations) return;
    if (type === "assigned" && !config.notifyAssignedMessages) return;

    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }

    toast.custom((t) => (
      <div 
        className={cn(
          "flex items-center gap-3 p-4 bg-white dark:bg-[#021B1A] border-2 border-primary/20 rounded-2xl shadow-2xl animate-in slide-in-from-right-5 duration-300",
          t.visible ? "opacity-100" : "opacity-0"
        )}
        onClick={() => {
          if (conversationId) navigate(`/chat/${conversationId}`);
          toast.dismiss(t.id);
        }}
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0">
          {type === "new" ? "📩" : "💬"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">{body}</p>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-8 px-2 text-[10px] font-black uppercase tracking-tighter text-primary hover:bg-primary/5"
        >
          Ver
        </Button>
      </div>
    ), {
      duration: 6000,
      id: conversationId || title, // Agrupar por conversa para não inundar a tela
    });
  }, [config]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ config, updateConfig, notify }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}

export { getNotificationConfig, setNotificationConfig };