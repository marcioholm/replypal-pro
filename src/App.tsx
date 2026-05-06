import { lazy, Suspense, Component, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Loader2 } from "lucide-react";
import { SchedulerInit } from "@/components/SchedulerInit";

const InboxPage = lazy(() => import("@/pages/InboxPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const PipelinePage = lazy(() => import("@/pages/PipelinePage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const CustomerDetailsPage = lazy(() => import("@/pages/CustomerDetailsPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const TrainingPage = lazy(() => import("@/pages/TrainingPage"));
const ScheduledMessagesPage = lazy(() => import("@/pages/ScheduledMessagesPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
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
              <Suspense fallback={<LoadingFallback />}>
                <AppErrorBoundary>
                  <Routes>
                    <Route path="/" element={<InboxPage />} />
                    <Route path="/chat/:id" element={<ChatPage />} />
                    <Route path="/pipeline" element={<PipelinePage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/customers/:id" element={<CustomerDetailsPage />} />
                    <Route path="/training" element={<TrainingPage />} />
                    <Route path="/scheduled" element={<ScheduledMessagesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppErrorBoundary>
              </Suspense>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SchedulerInit />
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;