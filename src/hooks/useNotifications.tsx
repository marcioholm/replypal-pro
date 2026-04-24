import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { toast } from "sonner";

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
  notify: (title: string, body: string, type: "new" | "assigned") => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children, currentUser, userRole }: { children: ReactNode; currentUser: { id: string; name: string; role: string }; userRole: "admin" | "supervisor" | "atendente" }) {
  const [config, setConfig] = useState<NotificationConfig>(getNotificationConfig);

  const updateConfig = useCallback((newConfig: Partial<NotificationConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      setNotificationConfig(updated);
      return updated;
    });
  }, []);

  const notify = useCallback((title: string, body: string, type: "new" | "assigned") => {
    if (!config.enabled) return;

    if (type === "new" && !config.notifyNewConversations) return;
    if (type === "assigned" && !config.notifyAssignedMessages) return;

    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }

    toast(title, {
      description: body,
      duration: 5000,
      style: { cursor: "pointer" },
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