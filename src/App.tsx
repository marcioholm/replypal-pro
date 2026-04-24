import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import InboxPage from "@/pages/InboxPage";
import ChatPage from "@/pages/ChatPage";
import PipelinePage from "@/pages/PipelinePage";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import CustomersPage from "@/pages/CustomersPage";
import CustomerDetailsPage from "@/pages/CustomerDetailsPage";
import CalendarPage from "@/pages/CalendarPage";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/LoginPage";

const queryClient = new QueryClient();

type UserRole = "admin" | "supervisor" | "atendente" | "recepcionista";

const rolePermissions: Record<string, UserRole[]> = {
  "/settings": ["admin"],
  "/customers": ["admin", "supervisor", "atendente", "recepcionista"],
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
              <Routes>
                <Route path="/" element={<InboxPage />} />
                <Route path="/chat/:id" element={<ChatPage />} />
                <Route path="/pipeline" element={<PipelinePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetailsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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