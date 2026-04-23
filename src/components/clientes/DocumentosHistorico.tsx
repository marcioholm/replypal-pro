import { useState, useEffect, useCallback } from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Search, Download, Printer, ExternalLink, 
  ChevronLeft, ChevronRight, Filter, FileSpreadsheet, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Document {
  id: string;
  cliente_id: string;
  categoria: string;
  tipo: string;
  mes: number | null;
  ano: number | null;
  url: string;
  nome_arquivo: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface DocumentosHistoricoProps {
  clienteId: string;
  clienteNome: string;
}

const CATEGORIAS = ["Todos", "Fixo", "RH", "Financeiro", "Fiscal"];

const TIPOS: Record<string, string[]> = {
  "Todos": [],
  "Fixo": ["contrato_social", "certificado_digital"],
  "RH": ["folha_pagamento"],
  "Financeiro": ["faturamento", "compras", "vendas"],
  "Fiscal": ["documentos_fiscais", "boletos_honorarios"]
};

const TIPO_LABELS: Record<string, string> = {
  "contrato_social": "Contrato Social",
  "certificado_digital": "Certificado Digital",
  "folha_pagamento": "Folha de Pagamento",
  "faturamento": "Faturamento",
  "compras": "Compras",
  "vendas": "Vendas",
  "documentos_fiscais": "Documentos Fiscais",
  "boletos_honorarios": "Boletos / Honorários"
};

const MESES = [
  { value: "Todos", label: "Todos os Meses" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export default function DocumentosHistorico({ clienteId, clienteNome }: DocumentosHistoricoProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  const [filters, setFilters] = useState({
    categoria: "Todos",
    tipo: "Todos",
    mes: "Todos",
    ano: "Todos",
    uploaded_by: ""
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        cliente_id: clienteId,
        page: page.toString(),
        limit: "20"
      });
      if (filters.categoria !== "Todos") params.append("categoria", filters.categoria);
      if (filters.tipo !== "Todos") params.append("tipo", filters.tipo);
      if (filters.mes !== "Todos") params.append("mes", filters.mes);
      if (filters.ano !== "Todos") params.append("ano", filters.ano);
      if (filters.uploaded_by) params.append("uploaded_by", filters.uploaded_by);

      const response = await fetch(`/api/documentos?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documentos);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, [clienteId, page, filters]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportCSV = () => {
    if (documents.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = ["Documento", "Categoria", "Mês", "Ano", "Enviado por", "Data", "URL"];
    const rows = documents.map(d => [
      TIPO_LABELS[d.tipo] || d.tipo,
      d.categoria,
      d.mes || "Fixo",
      d.ano || "Fixo",
      d.uploaded_by,
      format(new Date(d.uploaded_at), "dd/MM/yyyy HH:mm"),
      d.url
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `historico_docs_${clienteNome.toLowerCase().replace(/\s+/g, "_")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const getPeriodoLabel = (doc: Document) => {
    if (doc.categoria === "Fixo") return "Documento Permanente";
    const mes = MESES.find(m => m.value === String(doc.mes))?.label || doc.mes;
    return `${mes} / ${doc.ano}`;
  };

  return (
    <div className="space-y-6">
      {/* Estilos para impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
          .print-header { display: block !important; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .print-footer { display: block !important; position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
          th { background-color: #f2f2f2; }
        }
        .print-header, .print-footer { display: none; }
      `}</style>

      {/* Header com Filtros */}
      <Card className="no-print">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} onClick={fetchHistory} />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Filtros de Pesquisa</CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{total} registros encontrados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-green-600" /> Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
                <Printer className="w-3.5 h-3.5 mr-2 text-orange-600" /> Exportar PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Categoria</label>
              <Select value={filters.categoria} onValueChange={(v) => setFilters(f => ({ ...f, categoria: v, tipo: "Todos" }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Tipo</label>
              <Select value={filters.tipo} onValueChange={(v) => setFilters(f => ({ ...f, tipo: v }))} disabled={filters.categoria === "Todos"}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos" className="text-xs">Todos os Tipos</SelectItem>
                  {TIPOS[filters.categoria]?.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{TIPO_LABELS[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Mês</label>
              <Select value={filters.mes} onValueChange={(v) => setFilters(f => ({ ...f, mes: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ano</label>
              <Select value={filters.ano} onValueChange={(v) => setFilters(f => ({ ...f, ano: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos" className="text-xs">Todos os Anos</SelectItem>
                  {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Colaborador</label>
              <div className="relative">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 opacity-40" />
                <Input 
                  placeholder="Nome..." 
                  className="h-8 pl-8 text-xs" 
                  value={filters.uploaded_by}
                  onChange={(e) => setFilters(f => ({ ...f, uploaded_by: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Resultados (Visível e Impressão) */}
      <div className="print-container">
        <div className="print-header">
          <h1 className="text-xl font-bold">Relatório de Documentos Enviados</h1>
          <p className="text-sm">Cliente: {clienteNome} | Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            Filtros aplicados: {filters.categoria} | {filters.mes !== "Todos" ? MESES.find(m => m.value === filters.mes)?.label : "Todos os meses"}
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold">Documento</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Categoria</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Período</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Enviado por</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Data de Envio</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-right no-print">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 opacity-50">Carregando histórico...</TableCell></TableRow>
              ) : documents.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">Nenhum registro encontrado para estes filtros.</TableCell></TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="max-w-[200px]">
                          <p className="text-xs font-bold truncate line-clamp-1">{TIPO_LABELS[doc.tipo] || doc.tipo}</p>
                          <p className="text-[9px] text-muted-foreground truncate italic">{doc.nome_arquivo || "arquivo sem nome"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-medium py-0 h-5">{doc.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {getPeriodoLabel(doc)}
                    </TableCell>
                    <TableCell className="text-xs opacity-80">
                      {doc.uploaded_by}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {format(new Date(doc.uploaded_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right no-print">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <Download className="w-3 h-3 mr-1" /> Baixar
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[10px]">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" /> Drive
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="print-footer">
          Sasaki Soluções Contábeis - Sistema ReplyPal Pro - Gerado eletronicamente em {format(new Date(), "dd/MM/yyyy")}
        </div>
      </div>

      {/* Paginação */}
      {!loading && total > 20 && (
        <div className="flex items-center justify-between px-2 no-print">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">
            Mostrando {documents.length} de {total} registros
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold px-2">{page}</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setPage(p => p + 1)}
              disabled={page * 20 >= total}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
