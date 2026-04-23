import { STATUS_CONFIG, type ConversationStatus } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

const colorMap: Record<string, string> = {
  "kanban-new": "bg-info/15 text-info border-info/30",
  "kanban-waiting": "bg-warning/15 text-warning border-warning/30",
  "kanban-active": "bg-primary/15 text-primary border-primary/30",
  "kanban-client": "bg-[hsl(262,83%,58%)]/15 text-[hsl(262,83%,58%)] border-[hsl(262,83%,58%)]/30",
  "kanban-resolved": "bg-success/15 text-success border-success/30",
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`text-[10px] font-medium px-2 py-0.5 ${colorMap[config.color] || ""}`}>
      {config.label}
    </Badge>
  );
}
