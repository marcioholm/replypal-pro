import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  LayoutDashboard, 
  Columns3, 
  Settings, 
  Users, 
  Calendar, 
  LogOut, 
  GraduationCap, 
  Send,
  Building2,
  ChevronRight,
  Bell
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { IAChatButton } from "./IAChat";
import { NewChatDialog } from "./chat/NewChatDialog";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Caixa de Entrada", url: "/", icon: MessageSquare, badge: "inbox" },
  { title: "Pipeline", url: "/pipeline", icon: Columns3, badge: "pipeline" },
  { title: "Clientes", url: "/customers", icon: Building2, badge: "customers" },
  { title: "Contatos", url: "/contacts", icon: Users, badge: "contacts" },
  { title: "Treinamento da IA", url: "/training", icon: GraduationCap, badge: "training" },
  { title: "Alertas Inteligentes", url: "/alerts", icon: Bell, badge: "alerts" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: "dashboard" },
  { title: "Agendamentos", url: "/scheduled", icon: Send, badge: "scheduled" },
  { title: "Calendário Fiscal", url: "/calendar", icon: Calendar, badge: "calendar" },
  { title: "Configurações", url: "/settings", icon: Settings, badge: "settings" },
];

const SIDEBAR_WIDTH = "240px";
const SIDEBAR_COLLAPSED_WIDTH = "72px";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const store = useStore();
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  // Calcular contagens baseadas na store
  const openCount = store.conversations.filter(c => 
    c.assignedTo === user?.id && 
    c.status?.toLowerCase() !== "resolvido"
  ).length;

  const queueCount = store.conversations.filter(c => 
    !c.assignedTo && 
    c.status?.toLowerCase() !== "resolvido"
  ).length;

  const atRiskCount = store.conversations.filter(c => {
    if (c.status?.toLowerCase() === "resolvido") return false;
    const slaStatus = store.getSLAStatus(c);
    return slaStatus === "estourado" || slaStatus === "em_risco";
  }).length;

  useEffect(() => {
    const fetchCounts = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId || tenantId.length < 5) return;

      try {
        const { data } = await supabase
          .from("conversas")
          .select("*") // Buscar tudo para garantir que a store tenha os dados se estiver vazia
          .eq("tenant_id", tenantId)
          .neq("status", "resolvido");
        
        if (data) {
          // Opcional: atualizar a store se ela estiver vazia
          if (store.conversations.length === 0 && data.length > 0) {
            store.addDbConversations(data.map(c => ({
              id: c.id,
              clientName: c.client_name || "Cliente",
              clientPhone: c.client_phone || "",
              lastMessage: c.last_message || "",
              lastMessageTime: new Date(c.last_message_time || Date.now()),
              status: c.status,
              tenantId: c.tenant_id,
              slaDeadline: c.sla_deadline ? new Date(c.sla_deadline) : undefined,
              tags: c.tags || []
            })));
          }
        }
      } catch (err) {
        console.error("Error fetching counts:", err);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 10000); // Aumentado para 10s já que a store sincroniza em tempo real
    return () => clearInterval(interval);
  }, [user?.tenantId, store.conversations.length]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const width = collapsed ? "w-20" : "w-[280px]";
  const left = 20;
  const top = 20;
  const bottom = 20;

  return (
    <aside 
      className={cn(
        "fixed z-50 transition-all duration-350 ease-out flex flex-col",
        width
      )}
      style={{ 
        left: `${left}px`, 
        top: `${top}px`, 
        height: `calc(100vh - ${top + bottom}px)`
      }}
    >
      <TooltipProvider delayDuration={0}>
        <div 
          className={cn(
            "relative h-full w-full overflow-hidden rounded-[26px]",
            "backdrop-blur-md",
            "bg-white/95 dark:bg-[#021B1A]/80",
            "border border-border/50 dark:border-white/10",
            "shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            "before:absolute before:inset-0 before:rounded-[26px]",
            "before:bg-gradient-to-br before:from-white/20 before:to-transparent",
            "before:pointer-events-none"
          )}
        >
          <div className="absolute inset-0 rounded-[26px] overflow-hidden">
            <div 
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1]"
              style={{
                background: `
                  radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, hsl(var(--primary)) 0%, transparent 40%)
                `,
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="p-6 flex items-center gap-4 border-b border-border/40">
                <style>{`
                  @keyframes pulse-green {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                  }
                `}</style>
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden transition-all duration-300 hover:rotate-3 active:scale-90 group/logo shadow-[0_4px_12px_rgba(34,199,169,0.15)]"
                  style={{
                    background: "white",
                    border: "1px solid hsl(var(--primary)/0.2)",
                  }}
                >
                  <img src="/operai-logo.png" alt="Operai" className="w-10 h-10 object-contain" />
                </div>
              <div className={cn(
                "flex flex-col overflow-hidden transition-all duration-300 ease-out",
                collapsed ? "opacity-0 w-0" : "opacity-100"
              )}>
                <span className="font-black text-base text-foreground tracking-tight whitespace-nowrap">
                  Operai
                </span>
                <span className="text-[10px] text-primary font-bold uppercase tracking-widest whitespace-nowrap opacity-80">AI Operations</span>
              </div>
            </div>

            <div className="p-3">
              <div className={cn(
                "px-3 py-3 rounded-[16px] bg-primary/5 border border-primary/10 transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[200px]"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Atendimento</span>
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping opacity-75" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xl font-black text-foreground">{openCount}</p>
                      <p className="text-[9px] text-muted-foreground font-medium uppercase">Meus atendimentos</p>
                    </div>
                    {queueCount > 0 && (
                      <div className="flex-1 text-right">
                        <p className="text-xl font-black text-primary">{queueCount}</p>
                        <p className="text-[9px] text-muted-foreground font-medium uppercase">Na fila</p>
                      </div>
                    )}
                  </div>
                  {atRiskCount > 0 && (
                    <div className="px-2.5 py-1.5 rounded-[10px] bg-destructive/10 border border-destructive/20 flex items-center justify-between">
                      <p className="text-[9px] text-destructive font-bold uppercase tracking-wider">Atenção (SLA)</p>
                      <p className="text-xs font-black text-destructive">{atRiskCount}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-2">
              <NewChatDialog collapsed={collapsed} />
            </div>

            <div className="flex-1 px-4 overflow-y-auto overflow-x-hidden scrollbar-thin">
              <div className="space-y-2 py-4">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.url || 
                    (item.url !== "/" && location.pathname.startsWith(item.url));
                  
                  return (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      end={item.url === "/"}
                      className={cn(
                        "group relative flex items-center gap-4 px-4 py-3.5 rounded-2xl",
                        "transition-all duration-300 ease-out",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.02]" 
                          : "text-foreground/60 hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      <div className="relative z-10 flex items-center gap-4">
                        <item.icon className={cn(
                          "w-5 h-5 flex-shrink-0 transition-all duration-300",
                          isActive 
                            ? "text-primary-foreground scale-110" 
                            : "text-foreground/30 group-hover:text-primary group-hover:scale-110"
                        )} />
                        <span className={cn(
                          "text-[13px] font-bold tracking-tight whitespace-nowrap transition-all duration-300 overflow-hidden",
                          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                        )}>
                          {item.title}
                        </span>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-border/40 space-y-2.5">
              <div className={cn(
                "px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[100px]"
              )}>
                <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest mb-1">Empresa</p>
                <p className="text-sm font-bold text-foreground truncate">{tenant?.name}</p>
              </div>
              
              <IAChatButton collapsed={collapsed} />
              
              <div className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[70px]"
              )}>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-primary">
                      {(user?.name || "").split(" ").map((n: string) => n[0]).join("")}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {collapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="w-full h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Sair"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-card border-border/50 text-foreground font-bold text-xs">
                    Sair
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-[60] group/toggle"
        >
          <div
            className="w-8 h-8 rounded-full bg-white dark:bg-card border border-border/50 dark:border-white/10 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 hover:scale-110 active:scale-95 hover:border-primary/50 group-hover/toggle:shadow-primary/20"
          >
            <div className={cn(
              "transition-transform duration-500 ease-in-out",
              collapsed ? "rotate-0" : "rotate-180"
            )}>
              <ChevronRight className="w-5 h-5 text-primary" />
            </div>
          </div>
        </button>
      </TooltipProvider>
    </aside>
  );
}