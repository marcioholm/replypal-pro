import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { User, Tenant, setCurrentTenantId } from "./store";
import { supabase } from "./supabase";
import { initializeDatabase } from "./dbSetup";

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

async function generateSalt(): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return btoa(String.fromCharCode(...salt));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  let saltBytes: Uint8Array;
  
  try {
    // Tenta decodificar como base64, se falhar usa como string pura
    saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  } catch {
    saltBytes = encoder.encode(salt);
  }
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  try {
    const computedHash = await hashPassword(password, salt);
    return computedHash === storedHash;
  } catch (e) {
    console.error("Hash verification error:", e);
    return false;
  }
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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
    initializeDatabase();
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
              setIsLoading(false);
            });
          } else {
            localStorage.removeItem("replypal_user");
            setIsLoading(false);
          }
        }).catch(() => {
          localStorage.removeItem("replypal_user");
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
    try {
      const { data: foundUser, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email.toLowerCase())
        .single();

      if (error || !foundUser) {
        console.error("Login detail:", error);
        if (error?.code === "PGRST116") {
          alert("E-mail ou senha incorretos.");
        } else {
          alert("Erro ao conectar com o banco de dados. Verifique a conexão.");
        }
        return false;
      }

      // Verificar senha com hash seguro
      const salt = foundUser.senha_salt;
      const storedHash = foundUser.senha_hash;
      
      let isValidPassword = false;
      
      try {
        if (salt && storedHash) {
          isValidPassword = await verifyPassword(password, salt, storedHash);
        }
      } catch (hashError) {
        console.warn("Secure hash check failed, trying legacy fallback.");
      }
      
      // Fallback
      if (!isValidPassword && foundUser.senha === password) {
        isValidPassword = true;
      }
      
      if (!isValidPassword) {
        alert("E-mail ou senha incorretos.");
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
    } catch (err) {
      console.error("Critical login error:", err);
      alert("Ocorreu um erro inesperado no login. Tente novamente.");
      return false;
    }
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

// Utilitário para gerar hash de senha (usar no console do browser para migrar senhas)
// Exemplo: auth.hashPassword('admin123').then(console.log)
export async function hashPasswordForMigration(password: string): Promise<{ salt: string; hash: string }> {
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt);
  return { salt, hash };
}

// Utilitário CLI: console.log(JSON.stringify(await hashPasswordForMigration('admin123')))