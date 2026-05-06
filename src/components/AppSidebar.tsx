import { useState } from "react";
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
  Cpu
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { IAChatButton } from "./IAChat";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Caixa de Entrada", url: "/", icon: MessageSquare, badge: "inbox" },
  { title: "Pipeline", url: "/pipeline", icon: Columns3, badge: "pipeline" },
  { title: "Clientes", url: "/customers", icon: Users, badge: "customers" },
  { title: "Treinamento da IA", url: "/training", icon: GraduationCap, badge: "training" },
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
  
  const openCount = store.conversations.filter(c => c.status !== "resolvido").length;
  const atRiskCount = store.conversations.filter(c => {
    const sla = store.getSLAStatus(c);
    return sla === "em_risco" || sla === "estourado";
  }).length;

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
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden transition-all duration-300 hover:rotate-3 active:scale-90 group/logo shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)/0.1) 0%, hsl(var(--primary)/0.25) 100%)",
                    border: "1px solid hsl(var(--primary)/0.2)",
                    animation: "pulse-green 4s infinite"
                  }}
                >
                  <Cpu className="w-6 h-6 text-primary animate-pulse" />
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
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xl font-black text-foreground">{openCount}</p>
                    <p className="text-[9px] text-muted-foreground font-medium uppercase">Conversas ativas</p>
                  </div>
                  {atRiskCount > 0 && (
                    <div className="px-2.5 py-1.5 rounded-[10px] bg-destructive/10 border border-destructive/20">
                      <p className="text-xs font-bold text-destructive">{atRiskCount}</p>
                      <p className="text-[8px] text-destructive/70 font-bold">SLA</p>
                    </div>
                  )}
                </div>
              </div>
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

            <div className="p-3 border-t border-[rgba(255,255,255,0.06)] space-y-2">
              <div className={cn(
                "px-3 py-2 rounded-[12px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.05)] transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[100px]"
              )}>
                <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider">Empresa</p>
                <p className="text-sm font-medium text-white">{tenant?.name}</p>
              </div>
              
              <IAChatButton collapsed={collapsed} />
              
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[rgba(255,255,255,0.04)] transition-colors overflow-hidden transition-all duration-300",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[60px]"
              )}>
                <div className="w-9 h-9 rounded-[12px] bg-[rgba(34,199,169,0.15)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[#22C7A9]">
                      {(user?.name || "").split(" ").map((n: string) => n[0]).join("")}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.5)] truncate uppercase tracking-wider">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-[10px] hover:bg-[rgba(239,68,68,0.15)] text-[rgba(255,255,255,0.4)] hover:text-[#EF4444] transition-colors flex-shrink-0"
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
                      className="w-full h-10 rounded-[14px] flex items-center justify-center text-[rgba(255,255,255,0.4)] hover:bg-[rgba(239,68,68,0.15)] hover:text-[#EF4444] transition-colors"
                      title="Sair"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#032B29] border-[rgba(255,255,255,0.1)] text-white">
                    Sair
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <button
            onClick={onToggle}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20"
          >
            <div
              className="w-6 h-6 rounded-full bg-[rgba(34,199,169,0.2)] border border-[rgba(34,199,169,0.3)] flex items-center justify-center backdrop-blur-md transition-transform duration-200 hover:scale-110 active:scale-90"
              style={{
                boxShadow: "0 2px 8px rgba(34,199,169,0.2)",
              }}
            >
              <div className={cn(
                "transition-transform duration-300",
                collapsed ? "rotate-0" : "rotate-180"
              )}>
                <ChevronRight className="w-3.5 h-3.5 text-[#22C7A9]" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}