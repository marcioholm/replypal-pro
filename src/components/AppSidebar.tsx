import { MessageSquare, LayoutDashboard, Columns3, Settings, Zap, Users, TrendingUp, PieChart, Building2, Calendar, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { IAChatButton } from "./IAChat";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Caixa de Entrada", url: "/", icon: MessageSquare, badge: "inbox" },
  { title: "Pipeline", url: "/pipeline", icon: Columns3, badge: "pipeline" },
  { title: "Clientes", url: "/customers", icon: Users, badge: "customers" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: "dashboard" },
  { title: "Calendário Fiscal", url: "/calendar", icon: Calendar, badge: "calendar" },
  { title: "Configurações", url: "/settings", icon: Settings, badge: "settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="flex flex-col h-full bg-sidebar">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sidebar-primary/20">
            <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-sidebar-accent-foreground tracking-tight">
                ReplyPal Pro
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 font-medium">Contabilidade</span>
            </div>
          )}
        </div>

        <div className="p-3">
          {!collapsed && (
            <div className="px-2 py-2 bg-sidebar-accent/30 rounded-lg mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-sidebar-foreground/80 uppercase tracking-wider">Atendimento</span>
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-lg font-bold text-sidebar-accent-foreground">{openCount}</p>
                  <p className="text-[9px] text-sidebar-foreground/50">Conversas ativas</p>
                </div>
                {atRiskCount > 0 && (
                  <div className="px-2 py-1 bg-destructive/20 rounded-md">
                    <p className="text-xs font-bold text-destructive">{atRiskCount}</p>
                    <p className="text-[8px] text-destructive/70">SLA</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <SidebarGroup className="flex-1 px-3">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.url || 
                  (item.url !== "/" && location.pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20" : "hover:bg-sidebar-accent/50 text-sidebar-foreground hover:text-sidebar-accent-foreground"}`}
                      >
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"}`} />
                        {!collapsed && (
                          <span className={`text-sm font-medium ${isActive ? "text-sidebar-primary-foreground" : ""}`}>
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="p-3 border-t border-sidebar-border/50 space-y-2">
          {!collapsed && tenant && (
            <div className="px-2 py-1.5 bg-sidebar-accent/20 rounded-md">
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Empresa</p>
              <p className="text-sm font-medium text-sidebar-accent-foreground">{tenant.name}</p>
            </div>
          )}
          <IAChatButton collapsed={collapsed} />
          {!collapsed ? (
            <div className="flex items-center gap-3 px-2 py-2 hover:bg-sidebar-accent/30 rounded-lg transition-colors">
              <div className="w-9 h-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-sidebar-primary">
                    {user?.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user?.name}</p>
                <p className="text-[10px] text-sidebar-accent-foreground/60 truncate uppercase tracking-wider">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-destructive/20 hover:text-destructive rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg hover:bg-destructive/20 flex items-center justify-center text-sidebar-foreground/60 hover:text-destructive mx-auto transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
