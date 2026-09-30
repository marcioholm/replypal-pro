import { Suspense, Component, lazy, type ComponentType, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { NotificationProvider } from "@/hooks/useNotifications";

// Importação direta das páginas principais para evitar problemas de lazy loading em produção
import LoginPage from "@/pages/LoginPage";
import InboxPage from "@/pages/InboxPage";

// Páginas secundárias carregadas sob demanda (cada uma vira um arquivo separado).
// Se um deploy novo invalidar os arquivos antigos, recarrega a página uma vez
// em vez de quebrar — era esse o problema que fazia o lazy falhar em produção.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const key = "chunk-reload";
    try {
      const mod = await factory();
      sessionStorage.removeItem(key);
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

const HomePage = lazyWithRetry(() => import("@/pages/HomePage"));
const ChatPage = lazyWithRetry(() => import("@/pages/ChatPage"));
const PipelinePage = lazyWithRetry(() => import("@/pages/PipelinePage"));
const DashboardPage = lazyWithRetry(() => import("@/pages/DashboardPage"));
const SettingsPage = lazyWithRetry(() => import("@/pages/SettingsPage"));
const CustomersPage = lazyWithRetry(() => import("@/pages/CustomersPage"));
const CustomerDetailsPage = lazyWithRetry(() => import("@/pages/CustomerDetailsPage"));
const CalendarPage = lazyWithRetry(() => import("@/pages/CalendarPage"));
const TrainingPage = lazyWithRetry(() => import("@/pages/TrainingPage"));
const AlertsPage = lazyWithRetry(() => import("@/pages/AlertsPage"));
const ScheduledMessagesPage = lazyWithRetry(() => import("@/pages/ScheduledMessagesPage"));
const DailyReportPage = lazyWithRetry(() => import("@/pages/DailyReportPage"));
const ContactsPage = lazyWithRetry(() => import("@/pages/ContactsPage"));
const HygienePage = lazyWithRetry(() => import("@/pages/HygienePage"));
const TechnicalContactsPage = lazyWithRetry(() => import("@/pages/TechnicalContactsPage"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const LandingPage = lazyWithRetry(() => import("@/pages/LandingPage"));
const PrivacyPolicyPage = lazyWithRetry(() => import("@/pages/PrivacyPolicyPage"));

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Algo deu errado</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Encontramos um erro inesperado. Você pode tentar recarregar a página.
          </p>
          {this.state.error && (
            <details className="w-full max-w-2xl mb-6 p-4 bg-muted/50 rounded-lg border border-border/50">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Detalhes do erro
              </summary>
              <pre className="mt-2 text-xs text-destructive overflow-auto max-h-40 p-2 bg-background rounded">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Recarregar Página
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Voltar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  );
}

const queryClient = new QueryClient();

type UserRole = "admin" | "supervisor" | "atendente" | "recepcionista";

const rolePermissions: Record<string, UserRole[]> = {
  "/settings": ["admin"],
  "/customers": ["admin", "supervisor", "atendente", "recepcionista"],
  "/contacts": ["admin", "supervisor", "atendente", "recepcionista"],
  "/training": ["admin", "supervisor"],
};

function hasPermission(path: string, userRole: UserRole): boolean {
  const requiredRoles = rolePermissions[path];
  if (!requiredRoles) return true;
  return requiredRoles.includes(userRole as UserRole);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const currentRole = (user?.role || "atendente") as UserRole;

  // Só checa permissão depois que o usuário carregou — antes, um admin que
  // recarregava /settings era mandado para a caixa de entrada.
  if (!isLoading && user && !hasPermission(location.pathname, currentRole)) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppErrorBoundary>
      <NotificationProvider 
        currentUser={{ id: user?.id || '', name: user?.name || '', role: user?.role || '' }} 
        userRole={currentRole}
      >
        <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          }
        />
        <Route path="/conheca" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
        <Route path="/privacidade" element={<Suspense fallback={<PageLoader />}><PrivacyPolicyPage /></Suspense>} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<InboxPage />} />
                    <Route path="/inicio" element={<HomePage />} />
                    <Route path="/chat/:id" element={<ChatPage />} />
                    <Route path="/pipeline" element={<PipelinePage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/customers/:id" element={<CustomerDetailsPage />} />
                    <Route path="/contacts" element={<ContactsPage />} />
                    <Route path="/contacts/hygiene" element={<HygienePage />} />
                    <Route path="/contacts/technical" element={<TechnicalContactsPage />} />
                    <Route path="/training" element={<TrainingPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/scheduled" element={<ScheduledMessagesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/reports/daily" element={<DailyReportPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        </Routes>
      </NotificationProvider>
    </AppErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner position="bottom-right" expand={true} richColors closeButton />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;