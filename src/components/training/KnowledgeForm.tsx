import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus, AlertCircle, Loader2, Tag, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface KnowledgeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: any;
}

const CATEGORIAS = [
  "Trabalhista / RH",
  "Fiscal",
  "Contábil",
  "Financeiro",
  "Atendimento",
  "Procedimentos internos",
  "Obrigações mensais",
  "Perguntas frequentes"
];

export default function KnowledgeForm({ open, onOpenChange, onSuccess, editData }: KnowledgeFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<{ id: string, nome_fantasia: string }[]>([]);
  
  const [form, setForm] = useState({
    titulo: "",
    categoria: "",
    subcategoria: "",
    conteudo: "",
    palavras_chave: [] as string[],
    cliente_id: "all", // "all" significa todos os clientes
    status: "ativo",
    origem: "manual",
    nivel_confianca: "alta",
    data_validade: "",
    link_url: ""
  });

  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (open) {
      fetchClientes();
      if (editData) {
        setForm({
          titulo: editData.titulo || "",
          categoria: editData.categoria || "",
          subcategoria: editData.subcategoria || "",
          conteudo: editData.conteudo || "",
          palavras_chave: editData.palavras_chave || [],
          cliente_id: editData.cliente_id || "all",
          status: editData.status || "ativo",
          origem: editData.origem || "manual",
          nivel_confianca: editData.nivel_confianca || "alta",
          data_validade: editData.data_validade ? editData.data_validade.split('T')[0] : "",
          link_url: editData.link_url || ""
        });
      } else {
        setForm({
          titulo: "",
          categoria: "",
          subcategoria: "",
          conteudo: "",
          palavras_chave: [],
          cliente_id: "all",
          status: "ativo",
          origem: "manual",
          nivel_confianca: "alta",
          data_validade: "",
          link_url: ""
        });
      }
    }
  }, [open, editData]);

  const fetchClientes = async () => {
    const { data } = await supabase.from("clientes").select("id,nome_fantasia").order("nome_fantasia");
    setClientes(data || []);
  };

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      if (!form.palavras_chave.includes(keywordInput.trim())) {
        setForm(prev => ({ ...prev, palavras_chave: [...prev.palavras_chave, keywordInput.trim()] }));
      }
      setKeywordInput("");
    }
  };

  const removeKeyword = (tag: string) => {
    setForm(prev => ({ ...prev, palavras_chave: prev.palavras_chave.filter(t => t !== tag) }));
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.categoria || !form.conteudo) {
      toast.error("Por favor, preencha os campos obrigatórios (*)");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        tenant_id: user?.tenantId,
        cliente_id: form.cliente_id === "all" ? null : form.cliente_id,
        link_url: form.link_url,
        updated_at: new Date().toISOString()
      };

      let result;
      if (editData) {
        // Se for edit, salvar histórico antes ou via trigger? Vamos salvar histórico manual para controle.
        const { error: histError } = await supabase.from("conhecimento_ia_historico").insert({
          conhecimento_id: editData.id,
          snapshot: editData
        });
        if (histError) console.error("Error saving history:", histError);

        result = await supabase.from("conhecimento_ia").update(payload).eq("id", editData.id);
      } else {
        result = await supabase.from("conhecimento_ia").insert(payload);
      }

      if (result.error) throw result.error;

      toast.success(editData ? "Conhecimento atualizado!" : "Novo conhecimento cadastrado!");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const error = err as Error;
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editData ? "Editar Conhecimento" : "Novo Conhecimento da IA"}
          </DialogTitle>
          <DialogDescription>
            Defina orientações claras. Quanto mais detalhado o conteúdo, melhor a IA responderá.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Título do Conhecimento *</Label>
              <Input 
                placeholder="Ex: Regras para envio de folha de pagamento" 
                value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                className="h-10 font-medium"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria *</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subcategoria</Label>
              <Input 
                placeholder="Ex: Admissões" 
                value={form.subcategoria}
                onChange={e => setForm(p => ({ ...p, subcategoria: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conteúdo / Orientação Oficial *</Label>
            <Textarea 
              placeholder="Descreva aqui o procedimento ou regra que a IA deve seguir..." 
              className="min-h-[150px] resize-none leading-relaxed"
              value={form.conteudo}
              onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Este texto será usado como fonte direta pela IA.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-primary italic">Escopo de Cliente</Label>
                <Select value={form.cliente_id} onValueChange={v => setForm(p => ({ ...p, cliente_id: v }))}>
                  <SelectTrigger className="h-10 bg-primary/5 border-primary/20">
                    <SelectValue placeholder="Selecione o Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Válido para TODOS os Clientes</SelectItem>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>

             <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status do Conhecimento</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo (IA consulta)</SelectItem>
                    <SelectItem value="pendente">Pendente de Curadoria</SelectItem>
                    <SelectItem value="inativo">Inativo (Em rascunho)</SelectItem>
                  </SelectContent>
                </Select>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nivel de Confiança</Label>
                <Select value={form.nivel_confianca} onValueChange={v => setForm(p => ({ ...p, nivel_confianca: v as any }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta (Confiável)</SelectItem>
                    <SelectItem value="media">Média (Verificar)</SelectItem>
                    <SelectItem value="revisar">Revisar (Pendente)</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             
             <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Palavras-chave (Tagging)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.palavras_chave.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 px-2 py-1">
                      {tag} <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => removeKeyword(tag)} />
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-40" />
                  <Input 
                    placeholder="Digite e aperte Enter para adicionar..." 
                    className="pl-9 h-10"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={handleAddKeyword}
                  />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Origem do Dado</Label>
                <Select value={form.origem} onValueChange={v => setForm(p => ({ ...p, origem: v as any }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (Digitado)</SelectItem>
                    <SelectItem value="conversa">Conversa Aprovada</SelectItem>
                    <SelectItem value="importado">Importação externa</SelectItem>
                  </SelectContent>
                </Select>
             </div>

             <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vencimento (Opcional)</Label>
                <div className="relative">
                   <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-40" />
                   <Input 
                    type="date" 
                    className="pl-9 h-10" 
                    value={form.data_validade}
                    onChange={e => setForm(p => ({ ...p, data_validade: e.target.value }))}
                   />
                </div>
             </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-blue-500 italic">Link do Documento (Drive / URL / Download)</Label>
            <Input 
              placeholder="https://drive.google.com/..." 
              value={form.link_url}
              onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
              className="h-10 bg-blue-500/5 border-blue-500/20"
            />
            <p className="text-[10px] text-muted-foreground">
              Se preenchido, a IA poderá enviar este link quando o cliente solicitar o documento.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="gap-2 px-8" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editData ? "Salvar Alterações" : "Salvar Conhecimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
