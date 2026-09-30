import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Moon, Settings, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { AppSidebar } from "@/components/AppSidebar";
import { IAChatPanel } from "@/components/IAChat";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationManager } from "@/components/NotificationManager";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PAGE_TITLES: [prefix: string, title: string][] = [
  ["/inicio", "Início"],
  ["/chat/", "Conversa"],
  ["/pipeline", "Pipeline"],
  ["/scheduled", "Agendamentos"],
  ["/customers/", "Cliente"],
  ["/customers", "Clientes"],
  ["/contacts/hygiene", "Higienização de contatos"],
  ["/contacts/technical", "Contatos técnicos"],
  ["/contacts", "Contatos"],
  ["/calendar", "Calendário Fiscal"],
  ["/dashboard", "Relatórios"],
  ["/alerts", "Alertas"],
  ["/training", "Treinamento da IA"],
  ["/settings/reports", "Relatório diário"],
  ["/settings", "Configurações"],
];

function pageTitle(pathname: string) {
  if (pathname === "/") return "Caixa de Entrada";
  return PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Conta+";
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  atendente: "Atendente",
  recepcionista: "Recepção",
};

function initials(name?: string) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase())
    .join("");
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const store = useStore();

  const hasAlerts = store.conversations.some(c => {
    if (c.status?.toLowerCase() === "resolvido") return false;
    return store.getSLAStatus(c) === "estourado";
  });

  const iconButton =
    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(215_84%_34%)] text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="min-h-screen w-full bg-background">
      <NotificationManager />
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div
        className="transition-[padding] duration-300 ease-out"
        style={{ paddingLeft: sidebarCollapsed ? 80 : 248 }}
      >
        <div className="flex min-h-screen flex-row">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[88px] shrink-0 items-center justify-between gap-6 px-8 pt-2">
              <h1 className="truncate text-[22px] font-extrabold tracking-tight text-foreground">
                {pageTitle(location.pathname)}
              </h1>
              <div className="flex items-center gap-2.5">
                <GlobalSearch />
                <NewChatDialog compact />
                <Link to="/alerts" aria-label="Alertas" className={iconButton}>
                  <Bell className="h-[18px] w-[18px]" />
                  {hasAlerts && (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-[hsl(215_84%_34%)] bg-[#F2A516]" />
                  )}
                </Link>
                <button
                  type="button"
                  aria-label="Assistente IA"
                  aria-pressed={store.isIAChatOpen}
                  onClick={() => store.setIAChatOpen(!store.isIAChatOpen)}
                  className={cn(iconButton, store.isIAChatOpen && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                >
                  <Sparkles className="h-[18px] w-[18px]" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-11 items-center gap-2.5 rounded-full bg-card pl-1 pr-3 text-left transition-colors hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-accent-foreground">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials(user?.name)
                        )}
                      </span>
                      <span className="hidden leading-tight md:block">
                        <span className="block max-w-[140px] truncate text-[13px] font-bold text-foreground">{user?.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[user?.role || ""] ?? user?.role}</span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <DropdownMenuLabel className="font-normal">
                      <p className="truncate text-sm font-bold">{user?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                      {resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                      {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
                    </DropdownMenuItem>
                    {user?.role === "admin" && (
                      <DropdownMenuItem onClick={() => navigate("/settings")}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configurações
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        logout();
                        navigate("/login");
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
          <IAChatPanel />
        </div>
      </div>
    </div>
  );
}
