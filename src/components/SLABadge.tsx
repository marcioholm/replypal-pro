import type { SLAStatus } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, XCircle } from "lucide-react";

const config: Record<SLAStatus, { label: string; className: string; icon: typeof Clock }> = {
  dentro_do_prazo: { label: "No prazo", className: "bg-success/15 text-success border-success/30", icon: Clock },
  em_risco: { label: "Em risco", className: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle },
  estourado: { label: "SLA estourado", className: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

export function SLABadge({ slaStatus }: { slaStatus: SLAStatus }) {
  const c = config[slaStatus];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`text-[10px] font-medium px-2 py-0.5 gap-1 ${c.className}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </Badge>
  );
}
