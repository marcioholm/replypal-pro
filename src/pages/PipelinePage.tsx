import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, formatRelativeTime, formatDuration, STATUS_CONFIG } from "@/lib/store";
import type { Conversation, ConversationStatus } from "@/lib/store";
import { TagBadge } from "@/components/TagBadge";
import { SLABadge } from "@/components/SLABadge";
import { Kanban, GripVertical, Clock, User } from "lucide-react";

const COLUMNS: ConversationStatus[] = ["novo", "aguardando_aceite", "em_atendimento", "aguardando_cliente", "resolvido"];

const columnColors: Record<ConversationStatus, string> = {
  novo: "bg-info",
  aguardando_aceite: "bg-warning",
  em_atendimento: "bg-primary",
  aguardando_cliente: "bg-[hsl(262,83%,58%)]",
  resolvido: "bg-success",
};

export default function PipelinePage() {
  const store = useStore();
  const navigate = useNavigate();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const getColumnConversations = (status: ConversationStatus) =>
    store.conversations.filter((c) => c.status === status).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

  const handleDragStart = (e: React.DragEvent, convId: string) => {
    setDraggedId(convId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ConversationStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    const conv = store.getConversation(draggedId);
    if (conv && conv.status !== targetStatus) {
      store.updateStatus(draggedId, targetStatus, store.currentUser);
    }
    setDraggedId(null);
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col bg-background">
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Kanban className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Pipeline de Atendimento</h1>
              <p className="text-xs text-muted-foreground">Arraste os cards entre as colunas para atualizar o status</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
            {store.conversations.length} conversas
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4 bg-muted/20">
        <div className="flex gap-4 min-w-max h-full">
          {COLUMNS.map((status) => {
            const convs = getColumnConversations(status);
            const config = STATUS_CONFIG[status];
            return (
              <div
                key={status}
                className="w-80 flex flex-col bg-card rounded-xl border border-border/50 shadow-lg shadow-black/5"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="p-4 flex items-center gap-3 border-b border-border/30">
                  <div className={`w-3 h-3 rounded-full ${columnColors[status]}`} />
                  <span className="text-sm font-semibold tracking-tight">{config.label}</span>
                  <span className="text-xs bg-muted/60 px-2 py-0.5 rounded-full text-muted-foreground ml-auto font-medium">
                    {convs.length}
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-3 scrollbar-thin">
                  {convs.map((conv) => {
                    const sla = store.getSLAStatus(conv);
                    return (
                      <div
                        key={conv.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, conv.id)}
                        onClick={() => navigate(`/chat/${conv.id}`)}
                        className={`bg-background rounded-lg border border-border/50 p-4 cursor-pointer hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 group ${draggedId === conv.id ? "opacity-50 scale-95" : ""}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-[10px] font-semibold text-primary">
                            {conv.clientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{conv.clientName}</p>
                            {conv.assignedToName && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {conv.assignedToName}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 pl-7">{conv.lastMessage}</p>
                        <div className="flex items-center gap-2 flex-wrap pl-2">
                          {conv.tags.slice(0, 2).map((t) => <TagBadge key={t} tagId={t} />)}
                          {status !== "resolvido" && <SLABadge slaStatus={sla} />}
                          {conv.startedAt && (
                            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(conv.startedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
