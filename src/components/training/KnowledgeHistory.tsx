import { useState, useEffect } from "react";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, User, Calendar, FileText, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  id: string;
  snapshot: any;
  created_at: string;
  alterado_por: string;
  perfil?: { name: string };
}

interface KnowledgeHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeId: string | null;
  knowledgeTitle: string | null;
}

export default function KnowledgeHistory({ open, onOpenChange, knowledgeId, knowledgeTitle }: KnowledgeHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && knowledgeId) {
      fetchHistory();
    }
  }, [open, knowledgeId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conhecimento_ia_historico")
        .select(`
          *,
          perfil:alterado_por (name)
        `)
        .eq("conhecimento_id", knowledgeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md border-l border-sidebar-border bg-sidebar/50 backdrop-blur-xl">
        <SheetHeader className="pb-6 border-b border-sidebar-border/50">
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Alterações
          </SheetTitle>
          <SheetDescription className="text-xs uppercase font-bold text-muted-foreground/60 tracking-widest mt-1">
            {knowledgeTitle || "Consultando registro..."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground italic text-sm">
              Carregando histórico...
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center opacity-30 italic">
              <History className="w-12 h-12 mb-4" />
              <p className="text-sm">Nenhuma versão anterior registrada.</p>
            </div>
          ) : (
            <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-sidebar-border/50">
              {history.map((item) => (
                <div key={item.id} className="relative pl-10 space-y-3 group">
                  {/* Timeline dot */}
                  <div className="absolute left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-primary/40 border-2 border-background group-hover:bg-primary transition-colors" />
                  
                  <div className="bg-background/80 border border-sidebar-border/50 rounded-xl p-4 shadow-sm group-hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-primary italic">
                         <Calendar className="w-3 h-3" />
                         {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-5">Versão Anterior</Badge>
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-start gap-2">
                          <User className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-semibold">{item.perfil?.name || "Usuário desconhecido"}</p>
                            <p className="text-[10px] text-muted-foreground uppercase opacity-60">Alterou os dados</p>
                          </div>
                       </div>

                       <div className="p-3 bg-muted/40 rounded-lg border border-dashed border-sidebar-border/50">
                          <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block">Conteúdo salvo nesta versão</label>
                          <p className="text-xs text-foreground/80 line-clamp-3 italic leading-relaxed">
                            "{item.snapshot.conteudo}"
                          </p>
                       </div>

                       <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="flex items-center gap-1 opacity-70">
                             <FileText className="w-3 h-3" /> {item.snapshot.categoria}
                          </div>
                          <div className="flex items-center gap-1 opacity-70 justify-end">
                             {item.snapshot.status === 'ativo' ? '🟢 Ativo' : '⚪ Inativo'}
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
