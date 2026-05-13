import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileCode, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { checkWhatsApp } from "@/lib/evolution";

interface ContactImportDialogProps {
  onSuccess: () => void;
}

export function ContactImportDialog({ onSuccess }: ContactImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const normalizePhone = (phone: string) => {
    let clean = phone.replace(/\D/g, "");
    // Se tiver 10 ou 11 dígitos e não começar com 55, adiciona 55
    if (clean.length >= 10 && clean.length <= 11 && !clean.startsWith("55")) {
      clean = "55" + clean;
    }
    return clean;
  };

  const handleVerify = async () => {
    if (!importText.trim()) return;
    setVerifying(true);
    
    const lines = importText.split("\n").filter(l => l.trim().includes(","));
    const verifiedLines: string[] = [];
    let count = 0;

    for (const line of lines) {
      const parts = line.split(",");
      const name = parts[0].trim();
      const phone = parts.slice(1).join(",").trim();
      const cleanPhone = normalizePhone(phone);
      
      const { exists } = await checkWhatsApp(cleanPhone);
      if (exists) {
        verifiedLines.push(line);
        count++;
      }
    }

    if (verifiedLines.length > 0) {
      setImportText(verifiedLines.join("\n"));
      toast.success(`${count} números verificados com WhatsApp!`);
    } else {
      toast.error("Nenhum dos números informados possui WhatsApp ativo.");
    }
    setVerifying(false);
  };

  const parseVCard = (vcardText: string) => {
    const contacts: { name: string; phone: string }[] = [];
    const vcards = vcardText.split("BEGIN:VCARD");

    vcards.forEach(v => {
      if (!v.trim()) return;
      const lines = v.split("\n");
      let name = "";
      let phone = "";

      lines.forEach(line => {
        if (line.startsWith("FN:")) {
          name = line.replace("FN:", "").trim();
        } else if (line.startsWith("TEL") && line.includes(":")) {
          // Captura TEL;TYPE=CELL:5511999999999 ou TEL:5511999999999
          const rawPhone = line.split(":")[1].trim();
          phone = normalizePhone(rawPhone);
        }
      });

      if (name && phone) {
        contacts.push({ name, phone });
      }
    });

    return contacts;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const contacts = parseVCard(text);
      if (contacts.length > 0) {
        const formattedText = contacts.map(c => `${c.name}, ${c.phone}`).join("\n");
        setImportText(formattedText);
        toast.success(`${contacts.length} contatos extraídos do VCard!`);
      } else {
        toast.error("Nenhum contato válido encontrado no arquivo VCard.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!importText.trim() || !user) return;

    setLoading(true);
    setResults(null);
    const lines = importText.split("\n").filter(l => l.trim().includes(","));
    
    let successCount = 0;
    const errors: string[] = [];

    const batchSize = 20;
    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize);
      const insertData = batch.map(line => {
        const parts = line.split(",");
        const name = parts[0].trim();
        const phone = parts.slice(1).join(",").trim();
        const cleanPhone = normalizePhone(phone);
        
        return {
          nome_fantasia: name,
          whatsapp: cleanPhone,
          telefone: cleanPhone,
          tenant_id: user.tenantId,
          status: 'Ativo',
          prioridade: 'Média',
          service_level: 'Padrão',
          preferred_channel: 'WhatsApp'
        };
      }).filter(d => d.nome_fantasia && d.whatsapp);

      if (insertData.length === 0) continue;

      const { error } = await supabase.from("clientes").upsert(insertData, { 
        onConflict: 'whatsapp,tenant_id',
        ignoreDuplicates: false 
      });
      
      if (error) {
        errors.push(`Erro no lote ${Math.floor(i/batchSize) + 1}: ${error.message}`);
      } else {
        successCount += insertData.length;
      }
    }

    setResults({ success: successCount, errors });
    setLoading(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} contatos importados com sucesso!`);
      onSuccess();
    }
    if (errors.length > 0) {
      toast.error(`Ocorreram ${errors.length} erros durante a importação.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setImportText(""); setResults(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
          <Upload className="h-4 w-4 text-primary" />
          Importar Lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Importar Lista de Contatos</DialogTitle>
          <DialogDescription>
            Cole uma lista de nomes e telefones ou envie um arquivo <strong>VCard (.vcf)</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {!results ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Entrada Manual</p>
                  <div className="flex gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".vcf" 
                      className="hidden" 
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 px-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 gap-1.5"
                    >
                      <FileCode className="w-3 h-3" />
                      VCard
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleVerify}
                      disabled={verifying || !importText.trim()}
                      className="h-7 px-2 text-[10px] font-bold uppercase tracking-widest text-green-500 hover:bg-green-500/5 gap-1.5"
                    >
                      {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Verificar WhatsApp
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Nome, Telefone (um por linha)..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="min-h-[200px] bg-muted/50 border-border/40 rounded-2xl focus:ring-primary/20 resize-none font-mono text-sm"
                />
              </div>
              <Button 
                onClick={handleImport} 
                className="w-full h-12 gap-2 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/10"
                disabled={loading || !importText.trim()}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Processar Importação
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4 py-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-12 h-12 text-success" />
                <h3 className="text-lg font-bold">Processamento Concluído</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-success/10 rounded-2xl border border-success/20">
                  <p className="text-2xl font-black text-success">{results.success}</p>
                  <p className="text-[10px] uppercase font-bold text-success/60">Sucessos</p>
                </div>
                <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20">
                  <p className="text-2xl font-black text-destructive">{results.errors.length}</p>
                  <p className="text-[10px] uppercase font-bold text-destructive/60">Falhas</p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-xl text-left">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Detalhes dos Erros
                  </p>
                  <ul className="text-[11px] space-y-1 text-destructive overflow-y-auto max-h-[100px]">
                    {results.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {results.errors.length > 5 && <li>... e mais {results.errors.length - 5} erros.</li>}
                  </ul>
                </div>
              )}

              <Button variant="outline" className="w-full rounded-2xl" onClick={() => setResults(null)}>
                Importar Mais
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
