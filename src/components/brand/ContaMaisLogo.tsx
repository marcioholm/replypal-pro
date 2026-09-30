import { cn } from "@/lib/utils";

interface ContaMaisLogoProps {
  /** Mostra só o símbolo (sidebar recolhida, favicon) */
  compact?: boolean;
  className?: string;
}

/** Nova Marca Conta+: texto "Conta" azul, com ícone "+" estilizado (pílula horizontal verde e vertical azul com checkmark) */
export function ContaMaisLogo({ compact, className }: ContaMaisLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {!compact && (
        <span className="text-3xl font-extrabold tracking-tight text-[#1b56b8]" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.04em" }}>
          Conta
        </span>
      )}
      <svg 
        viewBox="0 0 36 36" 
        className={cn("shrink-0", compact ? "w-8 h-8" : "w-[30px] h-[30px]")}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pílula Vertical Inferior (Azul escuro) */}
        <rect x="12" y="12" width="12" height="24" rx="6" fill="#0f3670" />
        
        {/* Pílula Horizontal (Verde) */}
        <rect x="0" y="12" width="36" height="12" rx="6" fill="#1fa163" />

        {/* Pílula Vertical Superior (Azul) */}
        <rect x="12" y="0" width="12" height="18" rx="6" fill="#1b56b8" />
        
        {/* Checkmark Branco */}
        <path 
          d="M15 8L17 10L21 6" 
          stroke="white" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
    </div>
  );
}
