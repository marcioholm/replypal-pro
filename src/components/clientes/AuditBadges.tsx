import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Severity = "CRITICAL" | "ATTENTION" | "DUPLICATE" | "OK";

export function AuditBadge({ severity }: { severity: Severity }) {
  const configs: Record<Severity, { label: string; className: string }> = {
    CRITICAL: { label: "Crítico", className: "bg-red-500/10 text-red-600 border-red-200" },
    ATTENTION: { label: "Atenção", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
    DUPLICATE: { label: "Duplicado", className: "bg-purple-500/10 text-purple-600 border-purple-200" },
    OK: { label: "Válido", className: "bg-green-500/10 text-green-600 border-green-200" },
  };

  const config = configs[severity] || configs.OK;

  return (
    <Badge variant="outline" className={cn("rounded-md px-2 py-0 h-5 text-[9px] font-black uppercase tracking-widest border shadow-sm", config.className)}>
      {config.label}
    </Badge>
  );
}

export function WhatsappBadge({ status }: { status: string }) {
  const configs: any = {
    "não verificado": { label: "Não Verificado", className: "bg-slate-100 text-slate-500 border-slate-200" },
    "possui WhatsApp": { label: "WhatsApp Ativo", className: "bg-green-500/10 text-green-600 border-green-200" },
    "não possui WhatsApp": { label: "Sem WhatsApp", className: "bg-red-500/10 text-red-600 border-red-200" },
    "erro na verificação": { label: "Erro na Consulta", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
    "verificação pendente": { label: "Verificando...", className: "bg-blue-500/10 text-blue-600 border-blue-200" },
  };

  const config = configs[status] || configs["não verificado"];

  return (
    <Badge variant="outline" className={cn("rounded-md px-2 py-0 h-5 text-[9px] font-black uppercase tracking-widest border shadow-sm", config.className)}>
      {config.label}
    </Badge>
  );
}
