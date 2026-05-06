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

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 transition-all duration-350 ease-out"
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          height: "calc(100vh - 64px)",
          maxHeight: "720px",
        }}
      >
        <div 
          className={cn(
            "relative h-full w-full overflow-hidden rounded-[26px]",
            "backdrop-blur-md",
            "bg-white/70 dark:bg-[#021B1A]/40",
            "border border-white/20 dark:border-white/10",
            "shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            "before:absolute before:inset-0 before:rounded-[26px]",
            "before:bg-gradient-to-br before:from-white/10 before:to-transparent",
            "before:pointer-events-none"
          )}
        >
          <div className="absolute inset-0 rounded-[26px] overflow-hidden">
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                background: `
                  radial-gradient(circle at 20% 20%, rgba(34,199,169,0.15) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(14,143,120,0.1) 0%, transparent 40%)
                `,
              }}
            />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwTDQwIDBIMjBMMCAyME00MCA0MFYyMEwwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-[0.3]" />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="p-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]">
                <style>{`
                  @keyframes pulse-cyan {
                    0% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(0, 229, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
                  }
                `}</style>
                <div 
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden transition-all duration-300 hover:scale-110 active:scale-95 group/logo"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(0,184,212,0.4) 100%)",
                    boxShadow: "0 4px 16px rgba(0,229,255,0.2)",
                    animation: "pulse-cyan 3s infinite"
                  }}
                >
                  <Cpu className="w-5 h-5 text-primary animate-pulse" />
                </div>
              <div className={cn(
                "flex flex-col overflow-hidden transition-all duration-300 ease-out",
                collapsed ? "opacity-0 w-0" : "opacity-100"
              )}>
                <span className="font-semibold text-sm text-foreground dark:text-white tracking-tight whitespace-nowrap">
                  Operai
                </span>
                <span className="text-[10px] text-muted-foreground dark:text-white/50 font-medium whitespace-nowrap">Inteligência Artificial</span>
              </div>
            </div>

            <div className="p-3">
              <div className={cn(
                "px-3 py-3 rounded-[16px] bg-[rgba(34,199,169,0.08)] border border-[rgba(34,199,169,0.12)] transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[200px]"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-[rgba(255,255,255,0.6)] uppercase tracking-wider">Atendimento</span>
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-[#22C7A9]" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#22C7A9] animate-ping opacity-75" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xl font-bold text-white">{openCount}</p>
                    <p className="text-[9px] text-[rgba(255,255,255,0.4)]">Conversas ativas</p>
                  </div>
                  {atRiskCount > 0 && (
                    <div className="px-2.5 py-1.5 rounded-[10px] bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.2)]">
                      <p className="text-xs font-bold text-[#EF4444]">{atRiskCount}</p>
                      <p className="text-[8px] text-[rgba(239,68,68,0.7)]">SLA</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 px-3 overflow-y-auto overflow-x-hidden">
              <div className="space-y-1.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.url || 
                    (item.url !== "/" && location.pathname.startsWith(item.url));
                  
                  return (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      end={item.url === "/"}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-[14px]",
                        "transition-all duration-300 ease-out",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div
                          className="absolute inset-0 rounded-[14px] transition-all duration-300"
                          style={{
                            boxShadow: "0 0 25px rgba(34,199,169,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
                          }}
                        />
                      )}
                      <div className={cn(
                        "relative z-10 flex items-center gap-3",
                        isActive && "text-[#021B1A]"
                      )}>
                        <item.icon className={cn(
                          "w-5 h-5 flex-shrink-0 transition-all duration-300",
                          isActive 
                            ? "text-[#021B1A]" 
                            : "text-[rgba(255,255,255,0.5)] group-hover:text-[rgba(255,255,255,0.8)]"
                        )} />
                        <span className={cn(
                          "text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden",
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