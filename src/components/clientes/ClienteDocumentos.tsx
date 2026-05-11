import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, Upload, CheckCircle2, AlertCircle, Loader2, 
  ExternalLink, Calendar, Paperclip, Building2, UserCircle, Calculator, FileCheck,
  History, X
} from "lucide-react";
import DocumentosHistorico from "./DocumentosHistorico";
import DadosFinanceiros from "./DadosFinanceiros";

import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Document {
  id: string;
  cliente_id: string;
  categoria: string;
  tipo: string;
  mes: number | null;
  ano: number | null;
  url: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface ClienteDocumentosProps {
  clienteId: string;
  clienteNome: string;
}

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const ANOS = [2024, 2025, 2026];

export default function ClienteDocumentos({ clienteId, clienteNome }: ClienteDocumentosProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const store = useStore();
  const { user } = useAuth();
  const webhookUrl = "https://northway.vps8204.panel.icontainer.cloud/webhook/documentos/upload";

  const [filters, setFilters] = useState({
    rh: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    financeiro: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    fiscal: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  });

  const fetchDocuments = async () => {
    setLoading(true);
    // Em produção, isso viria de uma API ou do próprio Supabase.
    // Por enquanto, simulamos uma carga vazia para evitar erros, já que a API local pode não estar pronta.
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [clienteId]);


  const handleFilterChange = (section: keyof typeof filters, key: 'month' | 'year', value: string) => {
    setFilters(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: parseInt(value)
      }
    }));
  };

  const getDocStatus = (tipo: string, category: string) => {
    const section = category.toLowerCase() as keyof typeof filters | 'fixo';
    if (section === 'fixo') {
      return documents.find(d => d.tipo === tipo);
    }
    const filter = filters[section as keyof typeof filters];
    return documents.find(d => 
      d.tipo === tipo && 
      d.mes === filter.month && 
      d.ano === filter.year
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-12">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-11 bg-muted/30 p-1">
          <TabsTrigger value="upload" className="flex items-center gap-2 font-bold text-xs tracking-tight">
            <Upload className="w-4 h-4" /> Enviar Documentos
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 font-bold text-xs tracking-tight">
            <History className="w-4 h-4" /> Histórico de Envios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 outline-none animate-in fade-in slide-in-from-left-2 duration-300">
          <DocumentSection 
            title="Documentos Fixos" 
            icon={<FileCheck className="w-5 h-5 text-primary" />}
            description="Contratos e certificados permanentes"
          >
            <div className="grid gap-3">
              <DocumentItem 
                tipo="contrato_social" 
                label="Contrato Social" 
                category="Fixo"
                month={0}
                year={0}
                status={getDocStatus("contrato_social", "Fixo")}
                clienteId={clienteId}
                clienteNome={clienteNome}
                onUploadSuccess={fetchDocuments}
                webhookUrl={webhookUrl}
                currentUser={user?.name || "Usuário"}
              />
              <DocumentItem 
                tipo="certificado_digital" 
                label="Certificado Digital" 
                category="Fixo"
                month={0}
                year={0}
                status={getDocStatus("certificado_digital", "Fixo")}
                clienteId={clienteId}
                clienteNome={clienteNome}
                onUploadSuccess={fetchDocuments}
                webhookUrl={webhookUrl}
                currentUser={user?.name || "Usuário"}
              />
            </div>
          </DocumentSection>

          <DocumentSection 
            title="Recursos Humanos (RH)" 
            icon={<UserCircle className="w-5 h-5 text-primary" />}
            description="Documentação de colaboradores e folha"
            filters={filters.rh}
            onFilterChange={(k, v) => handleFilterChange('rh', k, v)}
          >
            <div className="grid gap-3 text-sm">
              <DocumentItem 
                tipo="folha_pagamento" 
                label="Folha de Pagamento" 
                category="RH"
                month={filters.rh.month}
                year={filters.rh.year}
                status={getDocStatus("folha_pagamento", "RH")}
                clienteId={clienteId}
                clienteNome={clienteNome}
                onUploadSuccess={fetchDocuments}
                webhookUrl={webhookUrl}
                currentUser={user?.name || "Usuário"}
              />
            </div>
          </DocumentSection>

          <DadosFinanceiros 
            clienteId={clienteId} 
            clienteNome={clienteNome} 
            tenantId={user?.tenantId || ""} 
          />

          <DocumentSection 
            title="Fiscal" 
            icon={<Building2 className="w-5 h-5 text-primary" />}
            description="Obrigações e boletos fiscais"
            filters={filters.fiscal}
            onFilterChange={(k, v) => handleFilterChange('fiscal', k, v)}
          >
            <div className="grid gap-3">
              <DocumentItem 
                tipo="documentos_fiscais" 
                label="Documentos Fiscais" 
                category="Fiscal"
                month={filters.fiscal.month}
                year={filters.fiscal.year}
                status={getDocStatus("documentos_fiscais", "Fiscal")}
                clienteId={clienteId}
                clienteNome={clienteNome}
                onUploadSuccess={fetchDocuments}
                webhookUrl={webhookUrl}
                currentUser={user?.name || "Usuário"}
              />
              <DocumentItem 
                tipo="boletos_honorarios" 
                label="Boletos / Honorários" 
                category="Fiscal"
                month={filters.fiscal.month}
                year={filters.fiscal.year}
                status={getDocStatus("boletos_honorarios", "Fiscal")}
                clienteId={clienteId}
                clienteNome={clienteNome}
                onUploadSuccess={fetchDocuments}
                webhookUrl={webhookUrl}
                currentUser={user?.name || "Usuário"}
              />
            </div>
          </DocumentSection>
        </TabsContent>

        <TabsContent value="history" className="outline-none animate-in fade-in slide-in-from-right-2 duration-300">
          <DocumentosHistorico clienteId={clienteId} clienteNome={clienteNome} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface DocumentSectionProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
  filters?: { month: number; year: number };
  onFilterChange?: (key: 'month' | 'year', value: string) => void;
}

interface DocumentItemProps {
  tipo: string;
  label: string;
  category: string;
  month: number;
  year: number;
  status: Document | undefined;
  clienteId: string;
  clienteNome: string;
  onUploadSuccess?: () => void;
  webhookUrl?: string;
  currentUser?: string;
}

function DocumentSection({ title, icon, description, children, filters, onFilterChange }: DocumentSectionProps) {
  return (
    <Card className="border-none shadow-none bg-muted/40 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-background rounded-lg border shadow-sm">{icon}</div>
          <div>
            <CardTitle className="text-sm font-bold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground/60">{description}</CardDescription>
          </div>
        </div>
        {filters && (
          <div className="flex items-center gap-2">
            <Select value={String(filters.month)} onValueChange={(v) => onFilterChange?.('month', v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs font-medium">
                <Calendar className="w-3 h-3 mr-2 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={String(m.value)} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(filters.year)} onValueChange={(v) => onFilterChange?.('year', v)}>
              <SelectTrigger className="w-[90px] h-8 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(y => (
                  <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4 px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

function DocumentItem({ tipo, label, category, month, year, status, clienteId, clienteNome, onUploadSuccess, webhookUrl, currentUser }: DocumentItemProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      const payload = {
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        categoria: category,
        tipo: tipo,
        mes: month || null,
        ano: year || null,
        arquivo_base64: base64,
        arquivo_nome: selectedFile.name,
        arquivo_tipo: selectedFile.type,
        uploaded_by: currentUser
      };

      if (!webhookUrl) {
        throw new Error("A URL de envio de documentos (Webhook) não foi configurada no sistema.");
      }

      // Usar a nossa API interna como Proxy para ignorar bloqueios de CORS do n8n
      const response = await fetch("/api/proxy-webhook", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
           targetUrl: webhookUrl,
           ...payload
        })
      }).catch(err => {
        console.error("Erro ao falar com a API Proxy:", err);
        throw new Error(`O sistema não conseguiu acessar o servidor de envio interno. Verifique o console para detalhes.`);
      });

      if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(`O servidor n8n recusou a conexão via Proxy (${response.status}): ${errorJson.error || errorJson.message || "Erro desconhecido"}`);
      }

      toast.success(`${label} enviado com sucesso!`);
      setSelectedFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error("Detalhes do erro de upload:", error);
      toast.error(error instanceof Error ? error.message : "Erro desconhecido no envio");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-background rounded-xl border border-border/50 hover:border-primary/20 transition-all group gap-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted/30 rounded-lg group-hover:bg-primary/10 transition-colors">
          <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {status ? (
              <p className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 
                Enviado em {new Date(status.uploaded_at).toLocaleDateString()} por {status.uploaded_by}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 italic">
                <AlertCircle className="w-3 h-3 opacity-50" /> 
                Não enviado
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {selectedFile ? (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="h-8 max-w-[150px] truncate bg-primary/5 text-[11px] font-medium border-primary/20">
              <Paperclip className="w-3 h-3 mr-1" /> {selectedFile.name}
            </Badge>
            <Button 
              size="sm" 
              onClick={handleUpload} 
              disabled={uploading}
              className="h-8 px-3 text-xs bg-primary hover:bg-primary/90"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setSelectedFile(null)} 
              disabled={uploading}
              className="h-8 w-8 p-0"
            >
              <X className="w-3 h-3 opacity-50" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {status?.url && (
              <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs font-medium">
                <a href={status.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Visualizar
                </a>
              </Button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect}
            />
            <Button 
              size="sm" 
              variant="outline"
              className="h-8 px-3 text-xs shadow-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 opacity-60" /> Enviar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
