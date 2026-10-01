import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { MessageSquare, Calendar, Building, DollarSign, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OportunidadeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidadeId: string | null;
  onSaved: () => void;
}

const REGIMES = ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real", "Pessoa física", "Abertura de empresa"];
const SERVICOS_LISTA = [
  "Contabilidade mensal",
  "Folha de pagamento / RH",
  "Fiscal e tributário",
  "Abertura de empresa",
  "Alteração contratual",
  "Certificado digital",
  "BPO financeiro",
  "Planejamento tributário",
];

export function OportunidadeDrawer({
  open,
  onOpenChange,
  oportunidadeId,
  onSaved,
}: OportunidadeDrawerProps) {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [op, setOp] = useState<any>(null);

  // Form states
  const [nomeContato, setNomeContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [regime, setRegime] = useState<string>("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [colaboradores, setColaboradores] = useState("");
  const [valorMensal, setValorMensal] = useState<string>("");
  const [origem, setOrigem] = useState("whatsapp");
  const [responsavelId, setResponsavelId] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");
  const [proximoContatoEm, setProximoContatoEm] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open || !oportunidadeId) return;

    const fetchOp = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("oportunidades")
          .select("*")
          .eq("id", oportunidadeId)
          .single();

        if (error) throw error;
        setOp(data);

        setNomeContato(data.nome_contato || "");
        setTelefone(data.telefone || "");
        setEmpresaNome(data.empresa_nome || "");
        setCnpj(data.cnpj || "");
        setRegime(data.regime_pretendido || "");
        setServicos(data.servicos || []);
        setColaboradores(data.colaboradores || "");
        setValorMensal(data.valor_mensal_estimado ? String(data.valor_mensal_estimado) : "");
        setOrigem(data.origem || "whatsapp");
        setResponsavelId(data.responsavel_id || "");
        setProximoPasso(data.proximo_passo || "");
        setProximoContatoEm(data.proximo_contato_em || "");
        setObservacoes(data.observacoes || "");
      } catch (err: any) {
        console.error("Erro ao carregar oportunidade:", err);
        toast.error("Erro ao carregar dados do lead");
      } finally {
        setLoading(false);
      }
    };

    fetchOp();
  }, [open, oportunidadeId]);

  const toggleServico = (s: string) => {
    setServicos((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const handleSave = async () => {
    if (!oportunidadeId || !user?.tenantId) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("oportunidades")
        .update({
          nome_contato: nomeContato.trim(),
          telefone: telefone.trim() || null,
          empresa_nome: empresaNome.trim() || null,
          cnpj: cnpj.trim() || null,
          regime_pretendido: regime || null,
          servicos: servicos,
          colaboradores: colaboradores.trim() || null,
          valor_mensal_estimado: valorMensal ? parseFloat(valorMensal) : null,
          origem: origem,
          responsavel_id: responsavelId || null,
          proximo_passo: proximoPasso.trim() || null,
          proximo_contato_em: proximoContatoEm || null,
          observacoes: observacoes.trim() || null,
        })
        .eq("id", oportunidadeId);

      if (error) throw error;

      toast.success("Oportunidade atualizada com sucesso!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao salvar oportunidade:", err);
      toast.error(err.message || "Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 scrollbar-thin">
        <SheetHeader className="mb-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl font-extrabold">Editar Oportunidade</SheetTitle>
              <SheetDescription className="text-xs">
                Edite os dados cadastrais, próximos passos e detalhes da negociação.
              </SheetDescription>
            </div>
            {op?.conversa_id && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/chat/${op.conversa_id}`);
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                Abrir Conversa
              </Button>
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <p className="text-sm text-center py-20 text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Nome do contato *</Label>
                <Input
                  value={nomeContato}
                  onChange={(e) => setNomeContato(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Telefone / WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Nome da Empresa</Label>
                <Input
                  value={empresaNome}
                  onChange={(e) => setEmpresaNome(e.target.value)}
                  placeholder="Razão ou fantasia"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">CNPJ</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Regime pretendido</Label>
                <Select value={regime} onValueChange={setRegime}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione o regime" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Qtd. Colaboradores</Label>
                <Input
                  value={colaboradores}
                  onChange={(e) => setColaboradores(e.target.value)}
                  placeholder="Ex: 5 a 10"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Valor Mensal Estimado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-xs rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Origem do Lead</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="empreenda_hub">Empreenda Hub</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Responsável</Label>
                <Select value={responsavelId} onValueChange={setResponsavelId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {store.users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Data do Próximo Contato</Label>
                <Input
                  type="date"
                  value={proximoContatoEm}
                  onChange={(e) => setProximoContatoEm(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Próximo Passo / Ação</Label>
              <Input
                value={proximoPasso}
                onChange={(e) => setProximoPasso(e.target.value)}
                placeholder="Ex: Enviar proposta de honorários pelo WhatsApp"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">Serviços de Interesse</Label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-border bg-muted/20">
                {SERVICOS_LISTA.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={servicos.includes(s)}
                      onCheckedChange={() => toggleServico(s)}
                    />
                    <span className="truncate">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Histórico das conversas, detalhes tributários..."
                className="text-xs rounded-xl min-h-[90px] resize-none"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !nomeContato.trim()}
                className="bg-primary text-primary-foreground font-bold"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
