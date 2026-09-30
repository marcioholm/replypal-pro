import { ContaMaisLogo } from "@/components/brand/ContaMaisLogo";
import { useState, FormEvent, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Shield, AlertCircle } from "lucide-react";
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0d1117] relative px-4 font-sans">
      {/* Modal Container */}
      <div className="w-full max-w-[900px] bg-[#1a1c23] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row relative z-10 border border-white/5">
        
        {/* Left Side - Form */}
        <div className="w-full md:w-1/2 p-10 lg:p-14 flex flex-col relative justify-center">
          <ContaMaisLogo theme="dark" className="mb-12 scale-90 origin-left" />
          
          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-white mb-2 tracking-tight">Login</h1>
            <p className="text-sm text-slate-400">Entre com os detalhes da sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in zoom-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-2 relative">
              <Label htmlFor="email" className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange("email")}
                  className="bg-transparent border-0 border-b border-slate-700 rounded-none px-0 h-10 text-white shadow-none focus-visible:ring-0 focus-visible:border-[#1b56b8] transition-colors"
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>

            {/* Password Input */}
            <div className="space-y-2 relative">
              <Label htmlFor="password" className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange("password")}
                  className="bg-transparent border-0 border-b border-slate-700 rounded-none px-0 pr-8 h-10 text-white shadow-none focus-visible:ring-0 focus-visible:border-[#1b56b8] transition-colors font-mono"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            {/* Forgot Password */}
            <div className="flex justify-start pt-1">
              <button type="button" className="text-[11px] text-slate-400 hover:text-white transition-colors">
                Esqueceu a senha?
              </button>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#1b56b8] hover:bg-[#154699] text-white font-semibold rounded-xl transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Entrar"
                )}
              </Button>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Não tem uma conta? </span>
              <button type="button" className="text-xs text-white font-medium hover:underline bg-white/5 px-3 py-1.5 rounded-lg ml-2 transition-colors hover:bg-white/10">
                Fale conosco
              </button>
            </div>
          </form>
        </div>

        {/* Right Side - Brand / Illustration */}
        <div className="hidden md:flex w-1/2 bg-[#1b56b8] p-12 flex-col justify-center items-center relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-black/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center space-y-6 flex flex-col items-center">
            {/* Minimalist illustration placeholder (using large icon) */}
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
              <Shield className="w-16 h-16 text-white" />
            </div>

            <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
              Bem-vindo ao<br/>portal do escritório
            </h2>
            <p className="text-white/80 text-sm max-w-[280px] mx-auto leading-relaxed font-medium">
              O atendimento do seu escritório, organizado do WhatsApp à carteira de clientes.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}