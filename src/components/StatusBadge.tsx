import { STATUS_CONFIG, type ConversationStatus } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

const colorMap: Record<string, string> = {
  "kanban-new": "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  "kanban-waiting": "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  "kanban-active": "bg-primary/10 text-primary border-primary/20",
  "kanban-client": "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  "kanban-resolved": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`text-[10px] font-medium px-2 py-0.5 ${colorMap[config.color] || ""}`}>
      {config.label}
    </Badge>
  );
}
