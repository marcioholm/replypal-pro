import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContaMaisLogoProps {
  /** Mostra só o símbolo (sidebar recolhida, favicon) */
  compact?: boolean;
  className?: string;
}

/** Marca Conta+: símbolo azul com "+" e wordmark com o "+" em verde. */
export function ContaMaisLogo({ compact, className }: ContaMaisLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(215_84%_34%)]">
        <Plus className="h-4 w-4 text-white" strokeWidth={3} />
      </span>
      {!compact && (
        <span className="text-[19px] font-extrabold leading-none tracking-tight text-[hsl(215_76%_20%)]">
          Conta<span className="text-[hsl(152_73%_37%)]">+</span>
        </span>
      )}
    </span>
  );
}
