import { MOCK_TAGS } from "@/lib/store";
import { X } from "lucide-react";

export function TagBadge({ tagId, onRemove }: { tagId: string; onRemove?: () => void }) {
  const tag = MOCK_TAGS.find((t) => t.id === tagId);
  if (!tag) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}44` }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
