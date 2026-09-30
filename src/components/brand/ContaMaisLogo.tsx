import { cn } from "@/lib/utils";

interface ContaMaisLogoProps {
  /** Mostra só o símbolo (sidebar recolhida, favicon) */
  compact?: boolean;
  className?: string;
  theme?: "light" | "dark";
}

/** Marca Oficial Conta+ */
export function ContaMaisLogo({ compact, className, theme = "light" }: ContaMaisLogoProps) {
  if (compact) {
    return (
      <div className={cn("inline-flex items-center justify-center", className)}>
        <img 
          src="/conta-mais-symbol.png" 
          alt="Conta+" 
          className="w-8 h-8 object-contain shrink-0" 
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center", className)}>
      <img 
        src="/conta-mais-logo.png" 
        alt="Conta+" 
        className={cn("h-7 w-auto object-contain shrink-0", theme === "dark" && "brightness-0 invert")} 
      />
    </div>
  );
}
