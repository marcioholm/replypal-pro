import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { User, Tenant, setCurrentTenantId } from "./store";
import { supabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("replypal_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Verificar no Supabase se o usuário ainda existe e carregar dados frescos
        supabase.from("usuarios").select("*").eq("id", parsed.id).single().then(({ data }) => {
          if (data) {
            const userData: User = {
              id: data.id,
              name: data.nome,
              email: data.email,
              role: data.role,
              tenantId: data.tenant_id,
              avatar: data.avatar
            };
            setUser(userData);
            supabase.from("tenants").select("*").eq("id", data.tenant_id).single().then(({ data: tData }) => {
              if (tData) {
                setTenant({ id: tData.id, name: tData.nome, subdomain: tData.subdomain });
                setCurrentTenantId(tData.id);
              }
            });
          } else {
            localStorage.removeItem("replypal_user");
          }
          setIsLoading(false);
        });
      } catch {
        localStorage.removeItem("replypal_user");
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { data: foundUser, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("senha", password) // Nota: Em produção real, usaríamos hash de senha
      .single();

    if (error || !foundUser) {
      console.error("Login detail:", error);
      if (error?.code === "PGRST116") {
        alert("E-mail ou senha incorretos.");
      } else {
        alert("Erro ao conectar com o banco de dados. Verifique o console ou as permissões de RLS no Supabase.");
      }
      return false;
    }

    const userData: User = {
      id: foundUser.id,
      name: foundUser.nome,
      email: foundUser.email,
      role: foundUser.role,
      tenantId: foundUser.tenant_id,
      avatar: foundUser.avatar
    };

    setUser(userData);
    const { data: foundTenant } = await supabase.from("tenants").select("*").eq("id", foundUser.tenant_id).single();
    if (foundTenant) {
      setTenant({ id: foundTenant.id, name: foundTenant.nome, subdomain: foundTenant.subdomain });
      setCurrentTenantId(foundTenant.id);
    }
    
    localStorage.setItem("replypal_user", JSON.stringify(userData));
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTenant(null);
    setCurrentTenantId(undefined);
    localStorage.removeItem("replypal_user");
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("usuarios").select("*").eq("id", user.id).single();
    if (data) {
      const userData: User = {
        id: data.id,
        name: data.nome,
        email: data.email,
        role: data.role,
        tenantId: data.tenant_id,
        avatar: data.avatar,
        whatsapp: data.whatsapp
      };
      setUser(userData);
      localStorage.setItem("replypal_user", JSON.stringify(userData));
    }
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}