import { ContaMaisLogo } from "@/components/brand/ContaMaisLogo";
import { useState, FormEvent, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0b] relative px-4 font-sans">
      {/* Modal Container */}
      <div className="w-full max-w-[960px] min-h-[600px] bg-[#18181b] rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(27,86,184,0.15)] flex flex-col md:flex-row relative z-10 border border-white/5">
        
        {/* Left Side - Form */}
        <div className="w-full md:w-1/2 p-12 lg:p-16 flex flex-col justify-center">
          <div className="mb-10">
            <div className="inline-flex items-center justify-center p-3.5 bg-white/5 border border-white/10 rounded-2xl shadow-xl backdrop-blur-sm mb-8">
              <ContaMaisLogo theme="dark" className="scale-110 origin-left ml-1" />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">Login</h1>
            <p className="text-[13px] text-zinc-400 font-medium">Entre com os detalhes da sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {errors.general && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in zoom-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="Email corporativo"
                value={formData.email}
                onChange={handleInputChange("email")}
                className="bg-transparent border-0 border-b border-zinc-700 rounded-none px-0 py-3 h-auto text-white text-[15px] shadow-none focus-visible:ring-0 focus-visible:border-[#1b56b8] placeholder:text-zinc-500 transition-colors"
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-xs text-red-400 absolute -bottom-5 left-0">{errors.email}</p>}
            </div>

            {/* Password Input */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={formData.password}
                onChange={handleInputChange("password")}
                className="bg-transparent border-0 border-b border-zinc-700 rounded-none px-0 py-3 pr-8 h-auto text-white text-[15px] shadow-none focus-visible:ring-0 focus-visible:border-[#1b56b8] placeholder:text-zinc-500 transition-colors font-mono"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {errors.password && <p className="text-xs text-red-400 absolute -bottom-5 left-0">{errors.password}</p>}
            </div>

            {/* Forgot Password */}
            <div className="flex justify-start mt-2">
              <button type="button" className="text-[12px] text-zinc-400 hover:text-white transition-colors font-medium">
                Esqueceu a senha?
              </button>
            </div>

            {/* Submit */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#1b56b8] hover:bg-[#154699] text-white font-semibold rounded-lg transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Entrar"
                )}
              </Button>
            </div>

            <div className="text-center pt-4">
              <span className="text-[13px] text-zinc-500 font-medium">Não tem uma conta? </span>
              <a 
                href="https://wa.me/5542999896358?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20a%20equipe%20do%20Conta%2B."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[13px] text-white font-medium hover:text-[#1b56b8] bg-zinc-800/50 px-4 py-1.5 rounded-md ml-2 transition-colors hover:bg-zinc-800"
              >
                Fale conosco
              </a>
            </div>
          </form>
        </div>

        {/* Right Side - Brand / Illustration */}
        <div className="hidden md:flex w-1/2 bg-[#1b56b8] p-12 flex-col relative overflow-hidden">
          
          {/* Imagem de Fundo (Contabilidade) com Overlay para não perder a cor da marca */}
          <div className="absolute inset-0">
            <img 
              src="/accounting_bg.png" 
              alt="Contabilidade" 
              className="w-full h-full object-cover opacity-30 mix-blend-overlay"
            />
            {/* Gradiente extra para garantir legibilidade do texto no rodapé */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1b56b8] via-transparent to-transparent opacity-80" />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="mt-8 space-y-4">
              <h2 className="text-[40px] font-bold text-white leading-[1.1] tracking-tight drop-shadow-md">
                Bem-vindo ao<br/>portal do escritório
              </h2>
              <p className="text-white/90 text-[15px] max-w-[300px] leading-relaxed font-medium drop-shadow">
                O atendimento do seu escritório, organizado do WhatsApp à carteira de clientes.
              </p>
            </div>
            <div className="flex-1" />
          </div>
        </div>

      </div>
    </div>
  );
}