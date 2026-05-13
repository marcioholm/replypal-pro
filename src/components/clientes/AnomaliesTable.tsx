import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info, Edit2, Check, ShieldCheck, Trash2, MoreHorizontal, MapPin } from "lucide-react";
import { AuditBadge, WhatsappBadge } from "./AuditBadges";
import { cn } from "@/lib/utils";

interface AnomaliesTableProps {
  list: any[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onEdit: (customer: any) => void;
  onApplySuggestion: (id: string, suggestion: string) => void;
  onCheckWhatsapp: (id: string, phone: string) => void;
  onMerge?: (id: string) => void;
  loading: boolean;
  showMasterCheckbox?: boolean;
  filteredData: any[];
  showLocation?: boolean;
  showWhatsappStatus?: boolean;
}

export function AnomaliesTable({ 
  list, selectedIds, setSelectedIds, onDelete, onEdit, 
  onApplySuggestion, onCheckWhatsapp, onMerge, loading, showMasterCheckbox, filteredData,
  showLocation, showWhatsappStatus
}: AnomaliesTableProps) {

  const formatWithHighlight = (text: string, range?: [number, number]) => {
    if (!range) return text;
    const start = range[0];
    const end = range[1];
    return (
      <>
        {text.substring(0, start)}
        <span className="bg-red-500/20 text-red-700 px-0.5 rounded mx-0.5 border border-red-200">{text.substring(start, end)}</span>
        {text.substring(end)}
      </>
    );
  };

  return (
    <Table>
      <TableHeader className="bg-muted/40 h-14">
        <TableRow className="hover:bg-transparent border-none">
          <TableHead className="w-12 pl-6 text-center">
            {showMasterCheckbox && (
              <input 
                type="checkbox" 
                className="rounded border-muted-foreground/30 accent-primary w-4 h-4 cursor-pointer"
                checked={selectedIds.length >= Math.min(filteredData.length, list.length) && list.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(list.map((d: any) => d.id));
                  else setSelectedIds([]);
                }}
              />
            )}
          </TableHead>
          <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Contato</TableHead>
          <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Status / WhatsApp</TableHead>
          {showLocation && <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Localização</TableHead>}
          <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Número Atual</TableHead>
          <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Sugestão de Correção</TableHead>
          <TableHead className="text-right pr-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 ? (
           <TableRow>
             <TableCell colSpan={7} className="h-40 text-center text-muted-foreground italic">
                Nenhum registro nesta categoria.
             </TableCell>
           </TableRow>
        ) : (
          list.map((d: any) => (
            <TableRow key={d.id} className="group hover:bg-muted/10 h-20 transition-all border-muted/20">
              <TableCell className="pl-6 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-muted-foreground/30 accent-primary w-4 h-4 cursor-pointer"
                  checked={selectedIds.includes(d.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, d.id]);
                    else setSelectedIds(selectedIds.filter((id: string) => id !== d.id));
                  }}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-foreground/90">{d.name}</span>
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{d.cnpj || "CPF/Avulso"}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <AuditBadge severity={d.audit.severity} />
                    {d.whatsapp_status && <WhatsappBadge status={d.whatsapp_status} />}
                  </div>
                  {d.audit.issues.map((issue: any, idx: number) => (
                    <span key={idx} className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Info className="w-2.5 h-2.5 opacity-50" />
                      {issue.message}
                    </span>
                  ))}
                </div>
              </TableCell>
              {showLocation && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">{d.audit.location || "N/A"}</span>
                  </div>
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2 group/phone">
                  <span className="font-mono text-sm tracking-tight font-bold">{d.whatsapp || d.phone}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/phone:opacity-100 transition-opacity rounded-lg" onClick={() => onEdit(d)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {d.audit.suggestion ? (
                  <button 
                    onClick={() => onApplySuggestion(d.id, d.audit.suggestion!)}
                    className="flex flex-col items-start gap-1 group/sug text-left hover:bg-primary/5 p-2 rounded-lg transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-primary font-black tracking-tight">
                        {formatWithHighlight(d.audit.suggestion, d.audit.issues.find((i: any) => i.highlightRange)?.highlightRange)}
                      </span>
                      <div className="p-1 bg-primary/10 rounded-full group-hover/sug:bg-primary/20 transition-colors">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Aplicar Sugestão</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50 italic font-medium">Nenhuma sugestão</span>
                )}
              </TableCell>
              <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1">
                    {d.audit.severity === "DUPLICATE" && onMerge && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all" 
                        onClick={() => onMerge(d.id)}
                        title="Mesclar Duplicado"
                      >
                        <Merge className="h-5 w-5" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-primary hover:bg-primary/10 rounded-xl transition-all" 
                      onClick={() => onCheckWhatsapp(d.id, d.whatsapp || d.phone)}
                      title="Verificar WhatsApp"
                      disabled={loading}
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl transition-all" onClick={() => onDelete(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl transition-all">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        ))}
      </TableBody>
    </Table>
  );
}
