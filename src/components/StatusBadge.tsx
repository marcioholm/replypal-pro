import { STATUS_CONFIG, type ConversationStatus } from "@/lib/store";
import { Chip, type ChipTone } from "@/components/conta-ui";

const toneMap: Record<string, ChipTone> = {
  "kanban-new": "blue",
  "kanban-waiting": "amber",
  "kanban-active": "soft",
  "kanban-client": "violet",
  "kanban-resolved": "green",
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <Chip tone="grey">{status || "Desconhecido"}</Chip>;
  return <Chip tone={toneMap[config.color] ?? "grey"}>{config.label}</Chip>;
}
