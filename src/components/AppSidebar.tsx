import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  LayoutDashboard, 
  Columns3, 
  Settings, 
  Users, 
  Calendar, 
  LogOut, 
  Bot, 
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
  { title: "Treinamento da IA", url: "/training", icon: Bot, badge: "training" },
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

  const [company, setCompany] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("replypal_company") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const c = JSON.parse(localStorage.getItem("replypal_company") || "null");
        setCompany(c);
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("replypal_company_updated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("replypal_company_updated", handleStorage);
    };
  }, []);

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
        "fixed left-0 top-0 bottom-0 z-50 transition-all duration-350 ease-out flex flex-col border-r border-[#26211d] bg-[#12100e]",
        width
      )}
    >
      <TooltipProvider delayDuration={0}>
        <div className="relative h-full w-full overflow-hidden flex flex-col">

          <div className="relative z-10 flex flex-col h-full">
            <div className="p-6 flex items-center gap-4 border-b border-[#26211d]">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden transition-all duration-300 hover:rotate-3 active:scale-90 shadow-sm"
                  style={{
                    background: "white",
                    border: "1px solid #3d342d",
                  }}
                >
                  <img src="/sasaki-logo.jpeg" alt="Sasaki" className="w-10 h-10 object-contain" />
                </div>
              <div className={cn(
                "flex flex-col overflow-hidden transition-all duration-300 ease-out",
                collapsed ? "opacity-0 w-0" : "opacity-100"
              )}>
                <span className="font-bold text-base text-[#f2efe9] tracking-tight whitespace-nowrap">
                  Sasaki
                </span>
                <span className="text-[10px] text-[#cda483] font-bold uppercase tracking-widest whitespace-nowrap opacity-90">Soluções Contábeis</span>
              </div>
            </div>

            <div className="p-3">
              <div className={cn(
                "px-3 py-3 rounded-lg bg-[#1e1915] border border-[#2c231c] transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[200px]"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#b2a59a] uppercase tracking-widest">Atendimento</span>
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-[#a37f61]" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#a37f61] animate-ping opacity-75" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xl font-bold text-[#f2efe9]">{openCount}</p>
                      <p className="text-[9px] text-[#b2a59a] font-medium uppercase">Meus atendimentos</p>
                    </div>
                    {queueCount > 0 && (
                      <div className="flex-1 text-right">
                        <p className="text-xl font-bold text-[#a37f61]">{queueCount}</p>
                        <p className="text-[9px] text-[#b2a59a] font-medium uppercase">Na fila</p>
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
                        "group relative flex items-center gap-4 px-4 py-3.5 rounded-lg",
                        "transition-all duration-300 ease-out",
                        isActive 
                          ? "bg-[#2c231c] text-[#f2efe9] border-l-4 border-[#a37f61] rounded-l-none" 
                          : "text-[#b2a59a] hover:bg-[#1e1915] hover:text-[#f2efe9]"
                      )}
                    >
                      <div className="relative z-10 flex items-center gap-4">
                        {item.title === "Treinamento da IA" ? (
                           <img src="/operai-logo.png" className={cn("w-5 h-5 flex-shrink-0 transition-all duration-300 object-contain filter brightness-125", isActive ? "scale-110" : "opacity-60 group-hover:opacity-100 group-hover:scale-110")} alt="IA" />
                        ) : (
                          <item.icon className={cn(
                            "w-5 h-5 flex-shrink-0 transition-all duration-300",
                            isActive 
                              ? "text-[#f2efe9] scale-110" 
                              : "text-[#8c7a6e] group-hover:text-[#f2efe9] group-hover:scale-110"
                          )} />
                        )}
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

            <div className="p-4 border-t border-[#26211d] space-y-2.5">
              
              <IAChatButton collapsed={collapsed} />
              
              <div className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#1e1915] transition-all duration-300 overflow-hidden",
                collapsed ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-[70px]"
              )}>
                <div className="w-10 h-10 rounded-lg bg-[#2c231c] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#3d342d]">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-[#a37f61]">
                      {(user?.name || "").split(" ").map((n: string) => n[0]).join("")}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#f2efe9] truncate">{user?.name}</p>
                  <p className="text-[10px] text-[#b2a59a] font-bold uppercase tracking-wider">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-lg hover:bg-[#2c231c] text-[#b2a59a] hover:text-destructive transition-all flex-shrink-0"
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
                      className="w-full h-10 rounded-lg flex items-center justify-center text-[#b2a59a] hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Sair"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#12100e] border-[#26211d] text-[#f2efe9] font-bold text-xs">
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
            className="w-8 h-8 rounded-full bg-[#12100e] border border-[#26211d] flex items-center justify-center shadow-md transition-all duration-300 hover:scale-110 active:scale-95 hover:border-[#a37f61]"
          >
            <div className={cn(
              "transition-transform duration-500 ease-in-out",
              collapsed ? "rotate-0" : "rotate-180"
            )}>
              <ChevronRight className="w-5 h-5 text-[#a37f61]" />
            </div>
          </div>
        </button>
      </TooltipProvider>
    </aside>
  );
}