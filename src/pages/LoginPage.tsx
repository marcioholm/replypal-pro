import { ContaMaisLogo } from "@/components/brand/ContaMaisLogo";
import { useState, FormEvent, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Loader2, Shield, Lock, Mail, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);

  const validateForm = useCallback((): LoginErrors => {
    const newErrors: LoginErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Digite um email válido";
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (formData.password.length < 4) {
      newErrors.password = "Senha deve ter pelo menos 4 caracteres";
    }

    return newErrors;
  }, [formData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const success = await login(formData.email, formData.password);
      if (success) {
        navigate("/");
      } else {
        setErrors({
          general: "Email ou senha incorretos. Tente novamente.",
        });
      }
    } catch {
      setErrors({
        general: "Ocorreu um erro. Tente novamente em alguns segundos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen w-full flex lg:grid lg:grid-cols-2 bg-background relative overflow-hidden">
      {/* Lado Esquerdo - Marca (apenas desktop) */}
      <div className="relative hidden overflow-hidden bg-sidebar-gradient p-12 lg:flex">
        <div className="relative z-10 flex h-full w-full max-w-xl flex-col justify-between">
          <div className="self-start rounded-2xl bg-white px-4 py-3">
            <ContaMaisLogo />
          </div>
          <div className="space-y-6">
            <p className="text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
              O atendimento do seu escritório, organizado do WhatsApp à carteira de clientes.
            </p>
            <p className="max-w-md text-lg text-white/75">
              Conversas, prazos de resposta, documentos e dados financeiros dos clientes num lugar só.
            </p>
          </div>
          <p className="text-sm text-white/60">© {new Date().getFullYear()} Conta+</p>
        </div>
      </div>

  {/* Lado Direito - Formulário de Login */}
  <div className="flex flex-col items-center justify-center px-4 py-8 relative w-full h-full">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-slate-100/50 to-slate-50 lg:hidden" />

    <Card className="w-full max-w-md relative z-10 border-slate-200/60 shadow-2xl shadow-slate-200/40 bg-white/90 backdrop-blur-md">
      <CardHeader className="space-y-6 pb-6">
        <div className="flex items-center justify-center lg:hidden">
          <ContaMaisLogo />
        </div>
        <div className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-slate-800">
            Acesse sua Conta
          </CardTitle>
          <CardDescription className="text-slate-500 text-base">
            Entre para gerenciar seu atendimento
          </CardDescription>
        </div>
      </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              {errors.general && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm animate-in fade-in zoom-in duration-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-slate-700 font-semibold text-sm"
                >
                  Email Corporativo
                </Label>
                <div className="relative group">
                  <Mail className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200", isFocused === "email" ? "text-primary" : "text-slate-400")} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@empresa.com.br"
                    value={formData.email}
                    onChange={handleInputChange("email")}
                    onFocus={() => setIsFocused("email")}
                    onBlur={() => setIsFocused(null)}
                    className={cn(
                      "pl-11 h-12 bg-slate-50/50 border-slate-200/80 text-slate-800 placeholder:text-slate-400 font-medium",
                      "focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15",
                      "transition-all duration-200 shadow-sm",
                      errors.email && "border-red-300 focus:border-red-400 focus:ring-red-500/20"
                    )}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-slate-700 font-semibold text-sm"
                  >
                    Senha
                  </Label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200", isFocused === "password" ? "text-primary" : "text-slate-400")} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange("password")}
                    onFocus={() => setIsFocused("password")}
                    onBlur={() => setIsFocused(null)}
                    className={cn(
                      "pl-11 pr-11 h-12 bg-slate-50/50 border-slate-200/80 text-slate-800 placeholder:text-slate-400 font-medium",
                      "focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15",
                      "transition-all duration-200 shadow-sm",
                      errors.password && "border-red-300 focus:border-red-400 focus:ring-red-500/20"
                    )}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary shadow-sm"
                />
                <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer font-medium hover:text-slate-800 transition-colors">
                  Lembrar minha sessão
                </Label>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-5 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base  disabled:opacity-70 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  "Entrar no Conta+"
                )}
              </Button>

              <div className="text-center text-xs text-slate-400/80 font-medium">
                Acesso restrito a colaboradores autorizados
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="absolute bottom-6 w-full text-center">
          <p className="text-xs font-medium text-slate-400">
            © {new Date().getFullYear()} Conta+
          </p>
        </div>
      </div>
    </div>
  );
}