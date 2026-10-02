import { useEffect } from "react";
import {
  Home,
  MessageSquare,
  Columns3,
  Send,
  Building2,
  Users,
  Calendar,
  LayoutDashboard,
  Bell,
  Bot,
  Settings,
  LogOut,
  ChevronRight,
  Filter,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore, type UserRole } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContaMaisLogo } from "@/components/brand/ContaMaisLogo";
import { cn } from "@/lib/utils";

type BadgeKey = "inbox" | "alerts" | "triagem";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: BadgeKey;
  /** Se definido, só esses papéis veem o item */
  roles?: UserRole[];
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Atendimento",
    items: [
      { title: "Início", url: "/inicio", icon: Home },
      { title: "Triagem", url: "/triagem", icon: Filter, badge: "triagem" },
      { title: "Caixa de Entrada", url: "/", icon: MessageSquare, badge: "inbox" },
      { title: "Pré-venda", url: "/pre-venda", icon: Sparkles, roles: ["admin", "supervisor"] },
      { title: "Pipeline", url: "/pipeline", icon: Columns3 },
      { title: "Agendamentos", url: "/scheduled", icon: Send },
    ],
  },
  {
    label: "Carteira",
    items: [
      { title: "Clientes", url: "/customers", icon: Building2 },
      { title: "Contatos", url: "/contacts", icon: Users },
      { title: "Calendário Fiscal", url: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Relatórios", url: "/dashboard", icon: LayoutDashboard },
      { title: "Alertas", url: "/alerts", icon: Bell, badge: "alerts" },
      { title: "Treinamento da IA", url: "/training", icon: Bot, roles: ["admin", "supervisor"] },
      { title: "Configurações", url: "/settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const store = useStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const openCount = store.conversations.filter(c => {
    const f = c.funil || "atendimento";
    return (f === "atendimento" || f === "triagem") && c.status?.toLowerCase() !== "resolvido";
  }).length;
  const triagemCount = store.conversations.filter(c => c.funil === "triagem").length;
  const atRiskCount = store.conversations.filter(c => {
    if ((c.funil || "atendimento") !== "atendimento" || c.status?.toLowerCase() === "resolvido") return false;
    const sla = store.getSLAStatus(c);
    return sla === "estourado" || sla === "em_risco";
  }).length;
  const badges: Record<BadgeKey, number> = { inbox: openCount, alerts: atRiskCount, triagem: triagemCount };

  // Hidrata a store uma única vez se ela estiver vazia. Depois disso as
  // contagens vêm da store, que o realtime mantém atualizada (antes: select * a cada 10s).
  const storeEmpty = store.conversations.length === 0;
  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!tenantId || tenantId.length < 5 || !storeEmpty) return;

    let cancelled = false;
    supabase
      .from("conversas")
      .select("id, client_name, client_phone, last_message, last_message_time, status, tenant_id, sla_deadline, tags, assigned_to, funil, arquivo_motivo, is_group, protocolo, customer_id")
      .eq("tenant_id", tenantId)
      .neq("status", "resolvido")
      .then(({ data, error }) => {
        if (cancelled || error || !data?.length) return;
        store.addDbConversations(data.map(c => ({
          id: c.id,
          clientName: c.client_name || "Cliente",
          clientPhone: c.client_phone || "",
          customerId: c.customer_id,
          lastMessage: c.last_message || "",
          lastMessageTime: new Date(c.last_message_time || Date.now()),
          status: c.status,
          tenantId: c.tenant_id,
          assignedTo: c.assigned_to,
          slaDeadline: c.sla_deadline ? new Date(c.sla_deadline) : undefined,
          tags: c.tags || [],
          isGroup: c.is_group,
          protocolo: c.protocolo,
          funil: c.funil,
          arquivoMotivo: c.arquivo_motivo,
        })));
      });
    return () => { cancelled = true; };
  }, [user?.tenantId, storeEmpty]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const role = (user?.role || "atendente") as UserRole;

  const isActive = (url: string) =>
    url === "/"
      ? location.pathname === "/" || location.pathname.startsWith("/chat/")
      : location.pathname === url || location.pathname.startsWith(url + "/");

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-sidebar-gradient text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-20" : "w-[256px]"
      )}
    >
      <TooltipProvider delayDuration={0}>
        <div className={cn("flex items-end justify-between pt-6 pb-6", collapsed ? "px-3 justify-center" : "px-[18px]")}>
          <div className={cn("flex items-center rounded-2xl bg-white", collapsed ? "p-2.5" : "px-3.5 py-2.5")}>
            <ContaMaisLogo compact={collapsed} />
          </div>
          {!collapsed && (
            <span className="text-right text-[10px] leading-tight text-sidebar-muted">
              v 3.0
              <br />
              {new Date().getFullYear()}
            </span>
          )}
        </div>

        <nav aria-label="Principal" className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3.5 pb-4 scrollbar-thin">
          {navGroups.map(group => {
            const items = group.items.filter(i => !i.roles || i.roles.includes(role));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="space-y-0.5">
                {!collapsed && (
                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-muted">
                    {group.label}
                  </p>
                )}
                {items.map(item => {
                  const active = isActive(item.url);
                  const count = item.badge ? badges[item.badge] : 0;
                  const link = (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      end={item.url === "/"}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-10 items-center gap-2.5 rounded-full text-sm transition-colors",
                        collapsed ? "justify-center px-0" : "pl-1 pr-3",
                        active ? "bg-sidebar-accent font-bold" : "font-medium hover:bg-white/[0.08]"
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 group-hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="h-[17px] w-[17px]" />
                        {collapsed && count > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--sidebar-background))] bg-[#22B573]" />
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{item.title}</span>}
                      {!collapsed && count > 0 && (
                        <span className="ml-auto flex h-5 min-w-[22px] items-center justify-center rounded-full bg-[#22B573] px-1.5 text-[11px] font-extrabold text-[#04311C] tabular">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </NavLink>
                  );
                  return collapsed ? (
                    <Tooltip key={item.url}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs font-semibold">
                        {item.title}
                        {count > 0 ? ` (${count})` : ""}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className={cn("space-y-1 pb-5", collapsed ? "px-3" : "px-3.5")}>
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex h-10 w-full items-center gap-2.5 rounded-full text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/[0.08]",
              collapsed ? "justify-center" : "px-3"
            )}
            aria-label="Sair"
          >
            <LogOut className="h-[17px] w-[17px]" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3.5 top-1/2 z-[60] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md transition-transform hover:scale-110"
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", !collapsed && "rotate-180")} />
        </button>
      </TooltipProvider>
    </aside>
  );
}
