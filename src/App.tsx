import { Suspense, Component, type ReactNode } from "react";
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

// Lazy loading apenas para páginas secundárias
import ChatPage from "@/pages/ChatPage";
import PipelinePage from "@/pages/PipelinePage";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import CustomersPage from "@/pages/CustomersPage";
import CustomerDetailsPage from "@/pages/CustomerDetailsPage";
import CalendarPage from "@/pages/CalendarPage";
import TrainingPage from "@/pages/TrainingPage";
import AlertsPage from "@/pages/AlertsPage";
import ScheduledMessagesPage from "@/pages/ScheduledMessagesPage";
import DailyReportPage from "@/pages/DailyReportPage";
import ContactsPage from "@/pages/ContactsPage";
import HygienePage from "@/pages/HygienePage";
import TechnicalContactsPage from "@/pages/TechnicalContactsPage";
import NotFound from "@/pages/NotFound";

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

function LoadingFallback() {
  return <PageLoader />;
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
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const currentRole = (user?.role || "atendente") as UserRole;

  if (!hasPermission(location.pathname, currentRole)) {
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
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                  <Routes>
                    <Route path="/" element={<InboxPage />} />
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
        <Sonner position="top-right" expand={true} richColors closeButton />
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