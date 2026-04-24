import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useStore, User, Customer, Contact, RegimeTributario, StatusCliente, Prioridade, NivelAtendimento, CanalPreferencial, StatusFinanceiro, TipoContato } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Building, BookOpen, Users, Headphones, DollarSign, FileText, Badge, Upload, Download, Table, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { webhooks } from "@/lib/webhooks";
import { initializeDatabase } from "@/lib/dbSetup";

const sampleData = [
  ["Razão Social", "Nome Fantasia", "CNPJ", "Responsável", "WhatsApp", "Telefone", "E-mail", "Cidade", "Estado", "Regime", "Natureza Jurídica", "CNAE", "Status", "Prioridade", "Nível", "Plano", "Valor Mensal", "Origem"],
  ["Empresa Teste LTDA", "Teste Solutions", "12345678901234", "João Silva", "11999999999", "1133333333", "joao@teste.com", "São Paulo", "SP", "Simples Nacional", "Sociedade Empresária Limitada", "6201-2/00", "Ativo", "Média", "Padrão", "Mensal", "500", "Indicação"],
  ["另一家公司 Ltda", "Company 2", "98765432109876", "Maria Santos", "11988888888", "1132222222", "maria@empresa2.com", "Rio de Janeiro", "RJ", "MEI", "Microempreendedor Individual", "6201-5/00", "Onboarding", "Baixa", "Padrão", "Básico", "200", "Site"],
];

const downloadTemplate = () => {
  const csvContent = sampleData.map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "modelo_importacao_clientes.csv";
  link.click();
  toast.success("Modelo baixado com sucesso!");
};

const parseCSV = (text: string) => {
  const lines = text.split("\n").filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/ã/g, "a").replace(/ç/g, "c"));
  const data: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    data.push(row);
  }
  
  return data;
};

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nome obrigatório"),
  role: z.string().min(2, "Cargo obrigatório"),
  phone: z.string(),
  whatsapp: z.string(),
  email: z.string().email("E-mail inválido"),
  type: z.enum(["Financeiro", "RH", "Fiscal", "Societário", "Outro"]),
});

const customerFormSchema = z.object({
  razaoSocial: z.string().min(2, "Razão Social obrigatória"),
  name: z.string().min(2, "Nome Fantasia obrigatório"),
  cnpj: z.string().min(14, "CNPJ inválido"),
  responsibleName: z.string().min(2, "Responsável obrigatório"),
  whatsapp: z.string().min(8, "WhatsApp inválido"),
  phone: z.string().min(8, "Telefone inválido"),
  email: z.string().email("E-mail inválido"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().min(2, "Estado obrigatório"),
  
  // Contábeis
  regime: z.enum(["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"]),
  naturezaJuridica: z.string().min(2, "Natureza Jurídica obrigatória"),
  cnae: z.string().min(2, "CNAE obrigatório"),
  openingDate: z.date().optional(),
  hasEmployees: z.boolean().default(false),
  employeeCount: z.number().min(0).default(0),
  
  // Atendimento
  consultantId: z.string().optional(),
  attendantId: z.string().optional(),
  supervisorId: z.string().optional(),
  status: z.enum(["Ativo", "Onboarding", "Inativo", "Encerrado"]),
  priority: z.enum(["Baixa", "Média", "Alta"]),
  serviceLevel: z.enum(["Padrão", "Premium", "Estratégico"]),
  preferredChannel: z.enum(["WhatsApp", "Email", "Telefone"]),
  preferredTime: z.string().optional(),
  
  // Comercial
  plan: z.string().min(2, "Plano obrigatório"),
  monthlyValue: z.number().min(0),
  startDate: z.date().optional(),
  financialStatus: z.enum(["Adimplente", "Inadimplente", "Atenção"]),
  origin: z.string().min(2, "Origem obrigatória"),
  
  // Outros
  contacts: z.array(contactSchema),
  observations: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  initialData?: Customer;
  onSuccess?: (customer: Customer) => void;
}

export function CustomerForm({ initialData, onSuccess }: CustomerFormProps) {
  const store = useStore();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user?.tenantId) return;
    
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("tenant_id", user.tenantId);
      
      if (data) {
        const team: User[] = data.map(d => ({
          id: d.id,
          name: d.nome,
          email: d.email,
          role: d.role,
          tenantId: d.tenant_id,
          avatar: d.avatar,
          whatsapp: d.whatsapp
        }));
        store.setUsers(team);
      }
    };
    
    fetchUsers();
  }, [user?.tenantId]);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      contacts: initialData.contacts || [],
      tags: initialData.tags || [],
    } : {
      razaoSocial: "",
      name: "",
      cnpj: "",
      responsibleName: "",
      whatsapp: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      regime: "Simples Nacional",
      naturezaJuridica: "",
      cnae: "",
      openingDate: undefined,
      hasEmployees: false,
      employeeCount: 0,
      status: "Ativo",
      priority: "Média",
      serviceLevel: "Padrão",
      preferredChannel: "WhatsApp",
      plan: "",
      monthlyValue: 0,
      startDate: undefined,
      financialStatus: "Adimplente",
      origin: "",
      contacts: [],
      observations: "",
      tags: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts",
  });

  const onSubmit = async (values: CustomerFormValues) => {
    try {
      if (initialData) {
        // Atualização
        const { error } = await supabase
          .from("clientes")
          .update({
            razao_social: values.razaoSocial,
            nome_fantasia: values.name,
            cnpj: values.cnpj,
            responsavel: values.responsibleName,
            whatsapp: values.whatsapp,
            telefone: values.phone,
            email: values.email,
            cidade: values.city,
            estado: values.state,
            regime: values.regime,
            natureza_juridica: values.naturezaJuridica,
            cnae: values.cnae,
            status: values.status,
            prioridade: values.priority,
            nivel_atendimento: values.serviceLevel,
            plano: values.plan,
            valor_mensal: values.monthlyValue,
            origem: values.origin
          })
          .eq("id", initialData.id);

        if (error) throw error;
        
        store.updateCustomer(initialData.id, values);
        toast.success("Cliente atualizado com sucesso!");
        if (onSuccess) onSuccess({ ...initialData, ...values });
      } else {
        // Novo Cadastro
        const existing = store.getCustomerByCnpj(values.cnpj);
        if (existing) {
          form.setError("cnpj", { message: "CNPJ já cadastrado" });
          return;
        }

        const { data, error } = await supabase
          .from("clientes")
          .insert([{
            tenant_id: user?.tenantId,
            razao_social: values.razaoSocial,
            nome_fantasia: values.name,
            cnpj: values.cnpj,
            responsavel: values.responsibleName,
            whatsapp: values.whatsapp,
            telefone: values.phone,
            email: values.email,
            cidade: values.city,
            estado: values.state,
            regime_tributario: values.regime,
            natureza_juridica: values.naturezaJuridica,
            cnae: values.cnae,
            status: values.status,
            prioridade: values.priority,
            service_level: values.serviceLevel,
            plan: values.plan,
            monthly_value: values.monthlyValue,
            financial_status: values.financialStatus,
            observations: values.observations
          }])
          .select()
          .single();

        if (error) throw error;

        // Converter do formato do banco para o formato do Store
        const newCustomer: Customer = {
          id: data.id,
          tenantId: data.tenant_id,
          razaoSocial: data.razao_social,
          name: data.nome_fantasia,
          cnpj: data.cnpj,
          responsibleName: data.responsavel,
          whatsapp: data.whatsapp,
          phone: data.telefone,
          email: data.email,
          city: data.cidade,
          state: data.estado,
          regime: data.regime_tributario,
          naturezaJuridica: data.natureza_juridica,
          cnae: data.cnae,
          status: data.status,
          priority: data.prioridade || data.priority,
          serviceLevel: data.service_level,
          plan: data.plan,
          monthlyValue: data.monthly_value,
          origin: data.origin || "Direto",
          contacts: values.contacts,
          tags: values.tags,
          observations: data.observations,
          financialStatus: data.financial_status,
          hasEmployees: !!data.has_employees,
          employeeCount: data.employee_count || 0,
          createdAt: new Date(data.created_at)
        };

        store.addCustomer(newCustomer);
        webhooks.triggerCustomerCreated(newCustomer, user!);
        toast.success("Cliente cadastrado com sucesso!");
        if (onSuccess) onSuccess(newCustomer);
      }
    } catch (error) {
      const err = error as Error;
      toast.error("Erro ao salvar cliente: " + (err.message || "Erro desconhecido"));
      console.error(error);
    }
  };
  
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          toast.error("Nenhum dado encontrado no arquivo");
          return;
        }
        setImportData(parsed);
        setImportOpen(true);
      } catch (err) {
        toast.error("Erro ao ler arquivo");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(0);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      try {
        const cnpj = row.cnpj || row.cnpjj?.replace(/[^0-9]/g, "");
        
        if (!cnpj || cnpj.length < 14) {
          errorCount++;
          continue;
        }
        
        const existing = store.getCustomerByCnpj(cnpj);
        if (existing) {
          errorCount++;
          continue;
        }
        
        store.addCustomer({
          razaoSocial: row.razaosocial || row["razao social"] || "",
          name: row.nomefantasia || row["nome fantasia"] || "",
          cnpj,
          responsibleName: row.responsavel || row.responsável || "",
          whatsapp: row.whatsapp || "",
          phone: row.telefone || "",
          email: row.email || row.e-mail || "",
          city: row.cidade || "",
          state: row.estado || row.uf || "",
          regime: (row.regime || "Simples Nacional") as RegimeTributario,
          naturezaJuridica: row.naturezajuridica || row["natureza jurídica"] || "",
          cnae: row.cnae || "",
          status: (row.status || "Ativo") as StatusCliente,
          priority: (row.prioridade || "Média") as Prioridade,
          serviceLevel: (row.nivel || row.nível || "Padrão") as NivelAtendimento,
          plan: row.plano || "",
          monthlyValue: parseFloat(row.valormensal || row["valor mensal"] || "0") || 0,
          origin: row.origem || "",
          financialStatus: "Adimplente" as StatusFinanceiro,
          contacts: [],
          tags: [],
          observations: "",
          hasEmployees: false,
          employeeCount: 0,
          consultantId: "",
          attendantId: "",
          preferredChannel: "WhatsApp",
          startDate: undefined,
          openingDate: undefined,
        });
        
        successCount++;
      } catch {
        errorCount++;
      }
      
      setImportProgress(Math.round(((i + 1) / importData.length) * 100));
    }
    
    setImporting(false);
    setImportOpen(false);
    setImportData([]);
    toast.success(`Importação concluída: ${successCount} clientes importados, ${errorCount} erros`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg">
            <Table className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Importação em massa</p>
            <p className="text-xs text-muted-foreground">Adicione múltiplos clientes via planilha CSV</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="w-4 h-4" />
            Modelo
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            Importar
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table className="w-5 h-5 text-primary" />
              Importar Clientes ({importData.length} registros)
            </DialogTitle>
          </DialogHeader>
          {importing ? (
            <div className="space-y-4 py-6">
              <div className="flex items-center justify-between text-sm">
                <span>Importando...</span>
                <span className="font-semibold">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Atenção</p>
                  <p className="text-amber-800 dark:text-amber-300">Clientes com CNPJ já cadastrado serão ignorados. Verifique os dados antes de importar.</p>
                </div>
              </div>
              
              <div className="max-h-[300px] overflow-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {importData[0] && Object.keys(importData[0]).map(key => (
                        <th key={key} className="px-3 py-2 text-left font-semibold capitalize">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 truncate max-w-[150px]">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importData.length > 5 && (
                  <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                    ... e mais {importData.length - 5} registros
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setImportOpen(false); setImportData([]); }}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} className="gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Importação
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Accordion type="multiple" defaultValue={["main", "accounting", "contacts"]} className="w-full">
          {/* Seção 1: Dados Principais */}
          <AccordionItem value="main" className="border rounded-lg px-4 mb-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                <span className="font-semibold text-base">Dados Principais</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <FormField control={form.control} name="razaoSocial" render={({ field }) => (
                <FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="responsibleName" render={({ field }) => (
                <FormItem><FormLabel>Nome do Responsável</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem><FormLabel>WhatsApp Principal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>Estado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Seção 2: Dados Contábeis */}
          <AccordionItem value="accounting" className="border rounded-lg px-4 mb-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="font-semibold text-base">Dados Contábeis</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <FormField control={form.control} name="regime" render={({ field }) => (
                <FormItem><FormLabel>Regime Tributário</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="naturezaJuridica" render={({ field }) => (
                <FormItem><FormLabel>Natureza Jurídica</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cnae" render={({ field }) => (
                <FormItem><FormLabel>CNAE Principal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="openingDate" render={({ field }) => (
                <FormItem><FormLabel>Data de Fundação (Empresa)</FormLabel><FormControl>
                  <Input type="date" {...field} 
                    value={field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ""} 
                    onChange={e => {
                      const d = new Date(e.target.value);
                      field.onChange(isNaN(d.getTime()) ? undefined : d);
                    }} 
                  />
                </FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex items-end gap-4 p-2 bg-muted/30 rounded-lg">
                <FormField control={form.control} name="hasEmployees" render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0 pb-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Possui Funcionários</FormLabel></FormItem>
                )} />
                <FormField control={form.control} name="employeeCount" render={({ field }) => (
                  <FormItem className="flex-1"><FormLabel>Qtd. Funcionários</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Seção 3: Contatos do Cliente */}
          <AccordionItem value="contacts" className="border rounded-lg px-4 mb-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold text-base">Contatos do Cliente</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg bg-muted/20 relative group">
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name={`contacts.${index}.name`} render={({ field }) => (
                      <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name={`contacts.${index}.role`} render={({ field }) => (
                      <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name={`contacts.${index}.type`} render={({ field }) => (
                      <FormItem><FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {["Financeiro", "RH", "Fiscal", "Societário", "Outro"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name={`contacts.${index}.phone`} render={({ field }) => (
                      <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name={`contacts.${index}.whatsapp`} render={({ field }) => (
                      <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name={`contacts.${index}.email`} render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full dashed border-primary/40 text-primary" onClick={() => append({ id: Math.random().toString(), name: "", role: "", phone: "", whatsapp: "", email: "", type: "Outro" })}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Contato
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Seção 4: Dados de Atendimento */}
          <AccordionItem value="atendimento" className="border rounded-lg px-4 mb-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-primary" />
                <span className="font-semibold text-base">Dados de Atendimento</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <FormField control={form.control} name="consultantId" render={({ field }) => (
                <FormItem><FormLabel>Consultor Responsável</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{store.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="attendantId" render={({ field }) => (
                <FormItem><FormLabel>Atendente Responsável</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{store.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status do Cliente</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{["Ativo", "Onboarding", "Inativo", "Encerrado"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem><FormLabel>Prioridade</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{["Baixa", "Média", "Alta"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="serviceLevel" render={({ field }) => (
                <FormItem><FormLabel>Nível de Atendimento</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{["Padrão", "Premium", "Estratégico"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="preferredChannel" render={({ field }) => (
                <FormItem><FormLabel>Canal Preferencial</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{["WhatsApp", "Email", "Telefone"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </AccordionContent>
          </AccordionItem>

          {/* Seção 5: Dados Comerciais */}
          <AccordionItem value="commercial" className="border rounded-lg px-4 mb-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <span className="font-semibold text-base">Dados Comerciais</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem><FormLabel>Plano Contratado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="monthlyValue" render={({ field }) => (
                <FormItem><FormLabel>Valor Mensal (R$)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="financialStatus" render={({ field }) => (
                <FormItem><FormLabel>Status Financeiro</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{["Adimplente", "Inadimplente", "Atenção"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="origin" render={({ field }) => (
                <FormItem><FormLabel>Origem do Cliente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Início da Parceria (Atendimento)</FormLabel><FormControl>
                  <Input type="date" {...field} 
                    value={field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ""} 
                    onChange={e => {
                      const d = new Date(e.target.value);
                      field.onChange(isNaN(d.getTime()) ? undefined : d);
                    }} 
                  />
                </FormControl><FormMessage /></FormItem>
              )} />
            </AccordionContent>
          </AccordionItem>

          {/* Seção 6: Observações Internas */}
          <AccordionItem value="notes" className="border rounded-lg px-4 mb-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold text-base">Observações Internas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <FormField control={form.control} name="observations" render={({ field }) => (
                <FormItem><FormControl><Textarea placeholder="Ex: cliente não atende ligação, sempre atrasa documentos..." className="min-h-[100px]" {...field} /></FormControl></FormItem>
              )} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background/80 backdrop-blur-sm p-4 z-10">
          <Button type="button" variant="outline" onClick={() => form.reset()}>Limpar</Button>
          <Button type="submit" className="min-w-[120px]">Salvar Cadastro</Button>
        </div>
      </form>
    </Form>
    </div>
  );
}
