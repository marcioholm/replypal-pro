import type { SLAStatus } from "@/lib/store";
import { Clock, AlertTriangle, XCircle } from "lucide-react";
import { Chip, type ChipTone } from "@/components/conta-ui";

const config: Record<SLAStatus, { label: string; tone: ChipTone; icon: typeof Clock }> = {
  ok: { label: "No prazo", tone: "green", icon: Clock },
  em_risco: { label: "SLA em risco", tone: "amber", icon: AlertTriangle },
  estourado: { label: "SLA estourado", tone: "red", icon: XCircle },
};

export function SLABadge({ slaStatus }: { slaStatus: SLAStatus }) {
  const c = config[slaStatus];
  const Icon = c.icon;
  return (
    <Chip tone={c.tone}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Chip>
  );
}
