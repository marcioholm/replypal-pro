import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Save, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DadosFinanceirosProps {
  clienteId: string;
  clienteNome: string;
  tenantId: string;
}

interface LinhaFinanceira {
  mes: number;
  ano: number;
  faturamento: number;
  compras: number;
  vendas: number;
  folha_pagamento: number;
  observacoes: string | null;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
].map((label, i) => ({ value: i + 1, label }));

const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL - 2, ANO_ATUAL - 1, ANO_ATUAL];

const FORM_VAZIO = { faturamento: 0, compras: 0, vendas: 0, folha_pagamento: 0, observacoes: "" };

const brl = (val: number) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseCurrency = (val: string) => Number(val.replace(/\D/g, "")) / 100;
const chave = (mes: number, ano: number) => ano * 100 + mes;

/**
 * Lançamento mensal de faturamento/compras/vendas/folha do cliente.
 * Tudo é gravado em `dados_financeiros` no Supabase — relatórios e a IA
 * leem direto do banco (ou da view `vw_financeiro_mensal`), sem Google Sheets.
 */
export default function DadosFinanceiros({ clienteId, tenantId }: DadosFinanceirosProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(ANO_ATUAL);
  const [form, setForm] = useState(FORM_VAZIO);
  const [historico, setHistorico] = useState<LinhaFinanceira[]>([]);

  const fetchHistorico = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dados_financeiros")
      .select("mes, ano, faturamento, compras, vendas, folha_pagamento, observacoes")
      .eq("cliente_id", clienteId)
      .gte("ano", ANO_ATUAL - 2)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });
    if (error) {
      console.error("Erro ao buscar dados financeiros:", error);
      toast.error("Não foi possível carregar os dados financeiros.");
    }
    setHistorico((data as LinhaFinanceira[]) || []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);

  // Preenche o formulário com o mês selecionado (se já lançado)
  useEffect(() => {
    const linha = historico.find(h => h.mes === mes && h.ano === ano);
    setForm(
      linha
        ? {
            faturamento: Number(linha.faturamento) || 0,
            compras: Number(linha.compras) || 0,
            vendas: Number(linha.vendas) || 0,
            folha_pagamento: Number(linha.folha_pagamento) || 0,
            observacoes: linha.observacoes || "",
          }
        : FORM_VAZIO
    );
  }, [historico, mes, ano]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("dados_financeiros").upsert(
      {
        cliente_id: clienteId,
        tenant_id: tenantId,
        mes,
        ano,
        ...form,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cliente_id,mes,ano" }
    );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`Dados de ${MESES[mes - 1].label}/${ano} salvos.`);
    fetchHistorico();
  };

  const handleInputChange = (field: "faturamento" | "compras" | "vendas" | "folha_pagamento", value: string) => {
    setForm(prev => ({ ...prev, [field]: parseCurrency(value) }));
  };

  // Últimos 12 lançamentos + total de faturamento no período
  const ultimos12 = historico.slice(0, 12);
  const total12 = ultimos12.reduce((s, h) => s + (Number(h.faturamento) || 0), 0);
  const selecionado = chave(mes, ano);

  const campos: { key: "faturamento" | "compras" | "vendas" | "folha_pagamento"; label: string; tone?: string }[] = [
    { key: "faturamento", label: "Faturamento", tone: "text-primary" },
    { key: "compras", label: "Compras" },
    { key: "vendas", label: "Vendas" },
    { key: "folha_pagamento", label: "Folha de pagamento" },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Dados financeiros</CardTitle>
            <CardDescription className="text-xs">Lançamento mensal · salvo no banco do Conta+</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger className="h-9 w-[130px] text-xs" aria-label="Mês">
              <Calendar className="mr-2 h-3.5 w-3.5 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map(m => (
                <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="h-9 w-[90px] text-xs" aria-label="Ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map(y => (
                <SelectItem key={y} value={String(y)} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pb-6">
        {loading && historico.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {campos.map(c => (
                <div key={c.key} className="space-y-1.5">
                  <Label htmlFor={`fin-${c.key}`} className="text-xs font-semibold text-muted-foreground">
                    {c.label}
                  </Label>
                  <Input
                    id={`fin-${c.key}`}
                    inputMode="numeric"
                    value={brl(form[c.key])}
                    onChange={e => handleInputChange(c.key, e.target.value)}
                    className={cn("font-semibold tabular", c.tone)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fin-obs" className="text-xs font-semibold text-muted-foreground">
                Observações
              </Label>
              <Textarea
                id="fin-obs"
                placeholder="Detalhes sobre o faturamento ou ocorrências do mês..."
                value={form.observacoes}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                className="h-20 resize-none text-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar {MESES[mes - 1].label}/{ano}
              </Button>
            </div>

            <div className="space-y-2 border-t border-border pt-5">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-bold">Histórico</h4>
                {ultimos12.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Faturamento nos últimos {ultimos12.length} lançamentos:{" "}
                    <span className="font-bold text-foreground tabular">{brl(total12)}</span>
                  </span>
                )}
              </div>
              {ultimos12.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Nenhum mês lançado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Competência</th>
                        <th className="py-2 pr-3 text-right font-semibold">Faturamento</th>
                        <th className="py-2 pr-3 text-right font-semibold">Compras</th>
                        <th className="py-2 pr-3 text-right font-semibold">Vendas</th>
                        <th className="py-2 text-right font-semibold">Folha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos12.map(h => {
                        const ativo = chave(h.mes, h.ano) === selecionado;
                        return (
                          <tr
                            key={`${h.ano}-${h.mes}`}
                            className={cn(
                              "cursor-pointer border-t border-border tabular transition-colors hover:bg-muted/60",
                              ativo && "bg-accent/60"
                            )}
                            onClick={() => {
                              setMes(h.mes);
                              setAno(h.ano);
                            }}
                          >
                            <td className="py-2 pr-3 font-semibold">
                              {MESES[h.mes - 1].label.slice(0, 3)}/{h.ano}
                            </td>
                            <td className="py-2 pr-3 text-right font-semibold text-primary">{brl(Number(h.faturamento) || 0)}</td>
                            <td className="py-2 pr-3 text-right">{brl(Number(h.compras) || 0)}</td>
                            <td className="py-2 pr-3 text-right">{brl(Number(h.vendas) || 0)}</td>
                            <td className="py-2 text-right">{brl(Number(h.folha_pagamento) || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
