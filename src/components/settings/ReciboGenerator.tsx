import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileText, Upload, Download, Plus, Trash2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { getSavedCompany, DEFAULT_COMPANY } from "@/lib/company";

const CONTADOR_KEY = "sasaki_contador";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

function getContador(): number {
  const saved = localStorage.getItem(CONTADOR_KEY);
  return saved ? parseInt(saved, 10) : 0;
}

function setContador(value: number) {
  localStorage.setItem(CONTADOR_KEY, String(value));
}

function numberToExtenso(value: number): string {
  const inteiro = Math.floor(value);
  const centavos = Math.round((value - inteiro) * 100);
  
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  
  function milhar(n: number, feminino: boolean): string {
    if (n === 0) return "";
    if (n < 20) return feminino ? unidades[n].replace("um", "uma").replace("dois", "duas").replace("três", "três") : unidades[n];
    
    const cent = Math.floor(n / 100);
    const rest = n % 100;
    let result = centenas[cent];
    
    if (rest > 0) {
      if (rest < 20) {
        result += feminino && rest === 1 ? " e uma" : ` e ${unidades[rest]}`;
      } else {
        const dez = Math.floor(rest / 10);
        const uni = rest % 10;
        result += ` e ${dezenas[dez]}`;
        if (uni > 0) result += feminino && uni === 2 ? " e duas" : ` e ${unidades[uni]}`;
      }
    }
    return result;
  }
  
  if (inteiro === 0) return "zero";
  if (inteiro === 1) return "um real";
  if (inteiro === 1000) return "mil reais";
  if (inteiro < 1000) return `${milhar(inteiro, false)} reais`;
  
  const mil = Math.floor(inteiro / 1000);
  const rest = inteiro % 1000;
  
  let result = "";
  if (mil === 1) {
    result = "mil";
  } else if (mil < 1000) {
    result = `${milhar(mil, false)} mil`;
  } else {
    const milhao = Math.floor(mil / 1000);
    const restMil = mil % 1000;
    if (milhão === 1) {
      result = "um milhão";
    } else {
      result = `${milhar(milhão, false)} milhões`;
    }
    if (restMil > 0) result += ` ${milhar(restMil, false)}`;
  }
  
  if (rest > 0) result += ` e ${milhar(rest, false)}`;
  result += " reais";
  
  if (centavos > 0) {
    result += ` e ${centavos === 1 ? "um centavo" : milhar(centavos, true) + " centavos"}`;
  }
  
  return result;
}

function formatReciboNumber(num: number, year: number): string {
  return String(num).padStart(4, "0") + "/" + year;
}

function generateReciboHTML(
  data: {
    numero: string;
    dataEmissao: string;
    cliente: string;
    valor: number;
    valorExtenso: string;
    mesReferencia: string;
    anoReferencia: number;
    responsavel: string;
    cargo: string;
    cidade: string;
    dataAssinatura: string;
    duasVias: boolean;
  },
  isSecondVia: boolean = false
): string {
  const hoje = new Date().toLocaleString("pt-BR");
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recibo ${data.numero}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 20px; }
    .header-top { display: flex; justify-content: space-between; font-size: 8px; color: #666; margin-bottom: 10px; }
    .box { border: 1px solid #ccc; padding: 15px; margin-bottom: 10px; }
    .box-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
    .logo { font-weight: bold; font-size: 12px; color: #333; }
    .recibo-title { font-weight: bold; font-size: 14px; }
    .box-content { display: flex; justify-content: space-between; gap: 20px; }
    .text-main { flex: 1; line-height: 1.8; }
    .valor-box { border: 2px solid #333; padding: 10px 20px; text-align: center; min-width: 120px; }
    .valor-amount { font-size: 18px; font-weight: bold; }
    .valor-label { font-size: 8px; color: #666; }
    .quitação { margin-top: 15px; font-style: italic; }
    .quitação strong { font-style: normal; }
    .footer { margin-top: 30px; text-align: center; }
    .signature-line { width: 250px; border-top: 1px solid #333; margin: 50px auto 5px; }
    .signature-name { font-weight: bold; }
    .signature-cargo { font-size: 10px; }
    .rodape { margin-top: 30px; font-size: 9px; text-align: center; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
    .divider { border-top: 1px dashed #999; margin: 20px 0; position: relative; }
    .divider::after { content: "✂ 2ª VIA ✂"; position: absolute; left: 50%; top: -10px; transform: translateX(-50%); background: #fff; padding: 0 10px; color: #999; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header-top">
    <span>${hoje}</span>
    <span>Recibo Online - ${data.numero}</span>
  </div>
  <div class="box">
    <div class="box-header">
      <div class="logo">{companyData.name}</div>
      <div class="recibo-title">Recibo de Pagamento</div>
    </div>
    <div class="box-content">
      <div class="text-main">
        <p>Recebemos de <strong>${data.cliente}</strong>, a importância de <strong>${data.valorExtenso}</strong>, referente aos HONORÁRIOS CONTÁBEIS DO MÊS DE ${data.mesReferencia.toUpperCase()}/${data.anoReferencia}.</p>
        <p class="quitação">Declaramos que quitaçãoilda, geral e irrevogável, nada mais a receber referente a este período.</p>
      </div>
      <div class="valor-box">
        <div class="valor-amount">R$ ${data.valor.toFixed(2).replace(".", ",")}</div>
        <div class="valor-label">VALOR RECEBIDO</div>
      </div>
    </div>
    <div class="footer">
      <p>${data.cidade}, ${data.dataAssinatura}</p>
      <div class="signature-line"></div>
      <p class="signature-name">${data.responsavel}</p>
      <p class="signature-cargo">${data.cargo}</p>
    </div>
  </div>
  <div class="rodape">{companyData.name} | CNPJ: {companyData.cnpj}</div>
  ${data.duasVias && !isSecondVia ? '<div class="divider"></div>' : ""}
  ${data.duasVias && !isSecondVia ? `
  <div class="header-top">
    <span>${hoje}</span>
    <span>Recibo Online - ${data.numero}</span>
  </div>
  <div class="box">
    <div class="box-header">
      <div class="logo">{companyData.name}</div>
      <div class="recibo-title">Recibo de Pagamento</div>
    </div>
    <div class="box-content">
      <div class="text-main">
        <p>Recebemos de <strong>${data.cliente}</strong>, a importância de <strong>${data.valorExtenso}</strong>, referente aos HONORÁRIOS CONTÁBEIS DO MÊS DE ${data.mesReferencia.toUpperCase()}/${data.anoReferencia}.</p>
        <p class="quitação">Declaramos que quitei, geral e irrevogável, nada mais a receber referente a este período.</p>
      </div>
      <div class="valor-box">
        <div class="valor-amount">R$ ${data.valor.toFixed(2).replace(".", ",")}</div>
        <div class="valor-label">VALOR RECEBIDO</div>
      </div>
    </div>
    <div class="footer">
      <p>${data.cidade}, ${data.dataAssinatura}</p>
      <div class="signature-line"></div>
      <p class="signature-name">${data.responsavel}</p>
      <p class="signature-cargo">${data.cargo}</p>
    </div>
  </div>
  <div class="rodape">{companyData.name} | CNPJ: {companyData.cnpj}</div>
  ` : ""}
</body>
</html>
  `.trim();
}

interface ReciboItem {
  id: string;
  cliente: string;
  valor: number;
  mesReferencia: string;
  anoReferencia: number;
  cidade: string;
  dataAssinatura: string;
  responsavel: string;
  cargo: string;
}

interface ReciboData {
  numero: string;
  dataEmissao: string;
  cliente: string;
  valor: number;
  valorExtenso: string;
  mesReferencia: string;
  anoReferencia: number;
  responsavel: string;
  cargo: string;
  cidade: string;
  dataAssinatura: string;
  duasVias: boolean;
}

export default function ReciboGenerator() {
  const [subTab, setSubTab] = useState<"individual" | "massa">("individual");
  
  const savedCompany = getSavedCompany();
  const companyData = savedCompany || DEFAULT_COMPANY;
  
  const [contador, setContadorState] = useState(getContador);
  const [duasVias, setDuasVias] = useState(false);
  
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split("T")[0]);
  const [cliente, setCliente] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [mesReferencia, setMesReferencia] = useState(MESES[currentMonth]);
  const [anoReferencia, setAnoReferencia] = useState(currentYear);
  const [responsavel, setResponsavel] = useState(companyData.name);
  const [cargo, setCargo] = useState("");
  const [cidade, setCidade] = useState("WENCESLAU BRAZ");
  const [dataAssinatura, setDataAssinatura] = useState(new Date().toISOString().split("T")[0]);
  
  const [listaRecibos, setListaRecibos] = useState<ReciboItem[]>([]);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualItem, setManualItem] = useState<Partial<ReciboItem>>({
    cliente: "",
    valor: 0,
    mesReferencia: MESES[currentMonth],
    anoReferencia: currentYear,
    cidade: "WENCESLAU BRAZ",
    dataAssinatura: new Date().toISOString().split("T")[0],
    responsavel: companyData.name,
    cargo: "",
  });


  const numeroRecibo = formatReciboNumber(contador + 1, currentYear);
  const valorExtenso = valor > 0 ? numberToExtenso(valor) : "";

  useEffect(() => {
    setContadorState(getContador());
  }, []);

  const handlePrint = useCallback(() => {
    if (!cliente || valor <= 0) {
      toast.error("Preencha o cliente e o valor.");
      return;
    }

    const reciboData: ReciboData = {
      numero: numeroRecibo,
      dataEmissao,
      cliente,
      valor,
      valorExtenso,
      mesReferencia,
      anoReferencia,
      responsavel,
      cargo,
      cidade,
      dataAssinatura,
      duasVias,
    };

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(generateReciboHTML(reciboData));
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 600);
    }

    const newContador = contador + 1;
    setContador(newContador);
    setContador(newContador);
    toast.success(`Recibo ${numeroRecibo} impresso!`);
  }, [cliente, valor, valorExtenso, mesReferencia, anoReferencia, responsavel, cargo, cidade, dataAssinatura, duasVias, numeroRecibo, contador, dataEmissao]);

  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].split(";").map(h => h.trim().toLowerCase());
      
      const newItems: ReciboItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(";");
        const item: Partial<ReciboItem> = {};
        headers.forEach((h, idx) => {
          const val = values[idx]?.trim() || "";
          if (h === "cliente_nome") item.cliente = val;
          else if (h === "valor") item.valor = parseFloat(val.replace(",", ".")) || 0;
          else if (h === "mes_referencia") item.mesReferencia = val;
          else if (h === "ano_referencia") item.anoReferencia = parseInt(val) || currentYear;
          else if (h === "cidade") item.cidade = val;
          else if (h === "data_assinatura") item.dataAssinatura = val;
          else if (h === "assinante") item.responsavel = val;
          else if (h === "cargo") item.cargo = val;
        });
        if (item.cliente && item.valor) {
          newItems.push(item as ReciboItem);
        }
      }
      setListaRecibos(prev => [...prev, ...newItems]);
      toast.success(`${newItems.length} recibos importados!`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handlePrintAll = useCallback(() => {
    if (listaRecibos.length === 0) {
      toast.error("Adicione recibos primeiro.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    let html = "";
    let currentContador = contador;

    listaRecibos.forEach((item, index) => {
      currentContador++;
      const data: ReciboData = {
        numero: formatReciboNumber(currentContador, currentYear),
        dataEmissao: new Date().toISOString().split("T")[0],
        cliente: item.cliente,
        valor: item.valor,
        valorExtenso: numberToExtenso(item.valor),
        mesReferencia: item.mesReferencia,
        anoReferencia: item.anoReferencia,
        responsavel: item.responsavel,
        cargo: item.cargo,
        cidade: item.cidade,
        dataAssinatura: item.dataAssinatura,
        duasVias: duasVias,
      };
      html += generateReciboHTML(data);
      if (index < listaRecibos.length - 1) {
        html += '<div style="page-break-after: always;"></div>';
      }
    });

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 600);

    setContador(currentContador);
    setContador(currentContador);
    setListaRecibos([]);
    toast.success(`${listaRecibos.length} recibos impressos!`);
  }, [listaRecibos, duasVias, contador]);

  const handleAddManualItem = useCallback(() => {
    if (!manualItem.cliente || !manualItem.valor) {
      toast.error("Preencha cliente e valor.");
      return;
    }
    setListaRecibos(prev => [...prev, { ...manualItem, id: `r${Date.now()}` } as ReciboItem]);
    setManualItem({
      cliente: "",
      valor: 0,
      mesReferencia: MESES[currentMonth],
      anoReferencia: currentYear,
      cidade: "WENCESLAU BRAZ",
      dataAssinatura: new Date().toISOString().split("T")[0],
      responsavel: companyData.name,
      cargo: "",
    });

    setShowAddManual(false);
    toast.success("Recibo adicionado à lista!");
  }, [manualItem]);

  const removeRecibo = useCallback((id: string) => {
    setListaRecibos(prev => prev.filter(r => r.id !== id));
  }, []);

  const downloadModel = () => {
    const csv = "cliente_nome;valor;mes_referencia;ano_referencia;cidade;data_assinatura;assinante;cargo\n;0;Janeiro;2026;WENCESLAU BRAZ;2026-01-01;Nome do Responsável;Cargo";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_recibos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "individual" | "massa")} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="massa" className="flex items-center gap-2 text-xs">
              <Upload className="w-3.5 h-3.5" />
              Em Massa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Gerar Recibo Individual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nº do Recibo</Label>
                    <Input value={numeroRecibo} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Emissão</Label>
                    <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Nome / Razão Social</Label>
                  <Input
                    placeholder="Cliente"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={valor || ""}
                      onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                    />
                    {valor > 0 && (
                      <p className="text-[10px] text-muted-foreground">{valorExtenso}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mês de Referência</Label>
                    <Select value={mesReferencia} onValueChange={setMesReferencia}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ano de Referência</Label>
                    <Input
                      type="number"
                      value={anoReferencia}
                      onChange={(e) => setAnoReferencia(parseInt(e.target.value) || currentYear)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável / Assinante</Label>
                  <Input
                    placeholder="Nome do responsável"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cargo</Label>
                    <Input
                      placeholder="Cargo"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Assinatura</Label>
                    <Input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={duasVias} onCheckedChange={setDuasVias} id="duas-vias" />
                  <Label htmlFor="duas-vias" className="text-xs">Imprimir duas vias</Label>
                </div>

                <Button onClick={handlePrint} className="w-full">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Recibo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="massa" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Recibos em Lote</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadModel}>
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Modelo CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddManual(!showAddManual)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Manual
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">Arraste o CSV ou clique para carregar</p>
                  </label>
                </div>

                {showAddManual && (
                  <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                    <p className="text-xs font-medium">Adicionar manualmente</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Cliente</Label>
                        <Input
                          className="h-8 text-xs"
                          value={manualItem.cliente}
                          onChange={(e) => setManualItem(p => ({ ...p, cliente: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Valor</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={manualItem.valor}
                          onChange={(e) => setManualItem(p => ({ ...p, valor: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Mês</Label>
                        <Select value={manualItem.mesReferencia} onValueChange={(v) => setManualItem(p => ({ ...p, mesReferencia: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Ano</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={manualItem.anoReferencia}
                          onChange={(e) => setManualItem(p => ({ ...p, anoReferencia: parseInt(e.target.value) || currentYear }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddManualItem}>Adicionar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddManual(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {listaRecibos.length > 0 && (
                  <>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {listaRecibos.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded border text-xs">
                          <div>
                            <span className="font-medium">{item.cliente}</span>
                            <span className="text-muted-foreground ml-2">R$ {item.valor.toFixed(2).replace(".", ",")}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeRecibo(item.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={duasVias} onCheckedChange={setDuasVias} id="duas-vias-massa" />
                      <Label htmlFor="duas-vias-massa" className="text-xs">Imprimir duas vias</Label>
                    </div>
                    <Button onClick={handlePrintAll} className="w-full">
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir Todos ({listaRecibos.length})
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden lg:block">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border bg-white p-4 min-h-[400px] text-[8px] text-gray-700 leading-relaxed">
              <div className="flex justify-between mb-2 text-gray-500">
                <span>{new Date().toLocaleString("pt-BR")}</span>
                <span>Recibo Online - {numeroRecibo}</span>
              </div>
              <div className="border border-gray-300 p-3 mb-2">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-[10px]">{companyData.name}</span>
                  <span className="font-bold text-[11px]">Recibo de Pagamento</span>
                </div>
                <div className="flex justify-between gap-2">
                  <div className="flex-1">
                    <p className="mb-1">
                      Recebemos de <strong>{cliente || "---"}</strong>, a importância de <strong>{valorExtenso || "---"}</strong>, referente aos HONORÁRIOS CONTÁBEIS DO MÊS DE {mesReferencia.toUpperCase()}/{anoReferencia}.
                    </p>
                    <p className="italic">
                      Declaramos que quitei, geral e irrevogável, nada mais a receber referente a este período.
                    </p>
                  </div>
                  <div className="border-2 border-gray-600 px-3 py-2 text-center min-w-[80px]">
                    <div className="font-bold text-sm">R$ {valor.toFixed(2).replace(".", ",")}</div>
                    <div className="text-[6px] text-gray-500">VALOR RECEBIDO</div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p>{cidade}, {dataAssinatura}</p>
                  <div className="w-40 border-t border-gray-600 mx-auto mt-6 mb-1"></div>
                  <p className="font-bold">{responsavel || "---"}</p>
                  <p className="text-[9px]">{cargo || "---"}</p>
                </div>
              </div>
              <div className="text-center text-[7px] text-gray-500 border-t border-gray-300 pt-2">
                {companyData.name} | CNPJ: {companyData.cnpj}
              </div>
              {duasVias && (
                <>
                  <div className="border-t border-dashed border-gray-400 my-2 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-white px-2 text-gray-400 text-[8px]">✂ 2ª VIA ✂</span>
                  </div>
                  <div className="border border-gray-300 p-3 mb-2">
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-[10px]">{companyData.name}</span>
                      <span className="font-bold text-[11px]">Recibo de Pagamento</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <div className="flex-1">
                        <p className="mb-1">
                          Recebemos de <strong>{cliente || "---"}</strong>, a importância de <strong>{valorExtenso || "---"}</strong>, referente aos HONORÁRIOS CONTÁBEIS DO MÊS DE {mesReferencia.toUpperCase()}/{anoReferencia}.
                        </p>
                        <p className="italic">
                          Declaramos que quitei, geral e irrevogável, nada mais a receber referente a este período.
                        </p>
                      </div>
                      <div className="border-2 border-gray-600 px-3 py-2 text-center min-w-[80px]">
                        <div className="font-bold text-sm">R$ {valor.toFixed(2).replace(".", ",")}</div>
                        <div className="text-[6px] text-gray-500">VALOR RECEBIDO</div>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p>{cidade}, {dataAssinatura}</p>
                      <div className="w-40 border-t border-gray-600 mx-auto mt-6 mb-1"></div>
                      <p className="font-bold">{responsavel || "---"}</p>
                      <p className="text-[9px]">{cargo || "---"}</p>
                    </div>
                  </div>
                  <div className="text-center text-[7px] text-gray-500 border-t border-gray-300 pt-2">
                    {companyData.name} | CNPJ: {companyData.cnpj}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}