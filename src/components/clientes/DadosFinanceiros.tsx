import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Save, Share, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface DadosFinanceirosProps {
  clienteId: string;
  clienteNome: string;
  tenantId: string;
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

export default function DadosFinanceiros({ clienteId, clienteNome, tenantId }: DadosFinanceirosProps) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  
  const [form, setForm] = useState({
    faturamento: 0,
    compras: 0,
    vendas: 0,
    folha_pagamento: 0,
    observacoes: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("dados_financeiros")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setForm({
          faturamento: data.faturamento || 0,
          compras: data.compras || 0,
          vendas: data.vendas || 0,
          folha_pagamento: data.folha_pagamento || 0,
          observacoes: data.observacoes || ""
        });
      } else {
        setForm({
          faturamento: 0,
          compras: 0,
          vendas: 0,
          folha_pagamento: 0,
          observacoes: ""
        });
      }
} catch (err) {
      const error = err as Error;
      console.error("Erro ao buscar dados financeiros:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clienteId, mes, ano]);

  const handleSave = async (silent = false) => {
    try {
      const { error } = await supabase
        .from("dados_financeiros")
        .upsert({
          cliente_id: clienteId,
          tenant_id: tenantId,
          mes,
          ano,
          ...form,
          updated_at: new Date().toISOString()
        }, { onConflict: 'cliente_id, mes, ano' });

      if (error) throw error;
      if (!silent) toast.success("Dados financeiros salvos com sucesso!");
      return true;
    } catch (err) {
      const error = err as Error;
      toast.error("Erro ao salvar: " + error.message);
      return false;
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const saved = await handleSave(true);
    if (!saved) {
      setExporting(false);
      return;
    }

    try {
      const webhookUrl = import.meta.env.VITE_N8N_FINANCEIRO_WEBHOOK;
      if (!webhookUrl) throw new Error("Webhook de exportação não configurado.");

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          mes,
          ano,
          ...form
        })
      });

      if (!response.ok) throw new Error("Erro ao exportar para o n8n.");
      
      const data = await response.json();
      toast.success("Exportado para Google Sheets com sucesso!");
      if (data.sheetsUrl || data.url) {
        window.open(data.sheetsUrl || data.url, "_blank");
      }
    } catch (err) {
      const error = err as Error;
      toast.error("Erro na exportação: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parseCurrency = (val: string) => {
    const clean = val.replace(/\D/g, "");
    return Number(clean) / 100;
  };

  const handleInputChange = (field: keyof typeof form, value: string) => {
    const numeric = parseCurrency(value);
    setForm(prev => ({ ...prev, [field]: numeric }));
  };

  return (
    <Card className="border-none shadow-none bg-muted/40 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-background rounded-lg border shadow-sm">
            <Calculator className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold tracking-tight">Dados Financeiros</CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground/60">
              Lançamento manual p/ exportação
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-xs font-medium">
              <Calendar className="w-3 h-3 mr-2 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map(m => (
                <SelectItem key={m.value} value={String(m.value)} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
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
      </CardHeader>
      
      <CardContent className="pt-6 px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground/70">Faturamento</Label>
                <Input 
                  value={formatCurrency(form.faturamento)}
                  onChange={(e) => handleInputChange('faturamento', e.target.value)}
                  className="font-mono font-bold text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground/70">Compras</Label>
                <Input 
                  value={formatCurrency(form.compras)}
                  onChange={(e) => handleInputChange('compras', e.target.value)}
                  className="font-mono font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground/70">Vendas</Label>
                <Input 
                  value={formatCurrency(form.vendas)}
                  onChange={(e) => handleInputChange('vendas', e.target.value)}
                  className="font-mono font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground/70">Folha de Pagamento</Label>
                <Input 
                  value={formatCurrency(form.folha_pagamento)}
                  onChange={(e) => handleInputChange('folha_pagamento', e.target.value)}
                  className="font-mono font-bold text-destructive"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground/70">Observações</Label>
              <Textarea 
                placeholder="Detalhes sobre o faturamento ou ocorrências do mês..."
                value={form.observacoes}
                onChange={(e) => setForm(p => ({ ...p, observacoes: e.target.value }))}
                className="resize-none h-20 text-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-muted-foreground/10">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-xs h-9" 
                onClick={() => handleSave()}
              >
                <Save className="w-4 h-4" />
                Salvar Localmente
              </Button>
              <Button 
                size="sm" 
                className="gap-2 text-xs h-9 bg-success hover:bg-success/90" 
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Share className="w-4 h-4" />
                    Exportar para Sheets
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
