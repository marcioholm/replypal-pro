import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore, type Customer } from "@/lib/store";
import { CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/CustomerForm";
import { ContactImportDialog } from "@/components/clientes/ContactImportDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Plus, Search, FilterX, Loader2, Users, CornerDownRight } from "lucide-react";
import { Chip, FilterGroup, FilterOption, HighlightBanner, InitialsAvatar, PillToggle, type ChipTone } from "@/components/conta-ui";

const REGIMES: { key: string; label: string; match: string }[] = [
  { key: "all", label: "Todos", match: "" },
  { key: "MEI", label: "MEI", match: "MEI" },
  { key: "Simples Nacional", label: "Simples", match: "Simples Nacional" },
  { key: "Lucro Presumido", label: "Presumido", match: "Lucro Presumido" },
  { key: "Lucro Real", label: "Real", match: "Lucro Real" },
];
const REGIME_SHORT: Record<string, string> = {
  MEI: "MEI",
  "Simples Nacional": "Simples",
  "Lucro Presumido": "Presumido",
  "Lucro Real": "Real",
};
const STATUS_TONE: Record<string, ChipTone> = { Ativo: "green", Onboarding: "amber", Inativo: "grey", Encerrado: "red" };
const FIN_CLASS: Record<string, string> = {
  Adimplente: "text-success",
  "Atenção": "text-amber-700 dark:text-amber-300",
  Inadimplente: "text-destructive",
};
const PAGE = 60;

function semWhatsapp(c: Customer) {
  return !c.whatsapp?.trim() || c.whatsapp_status === "não possui WhatsApp" || c.whatsapp_status === "erro na verificação";
}

export default function CustomersPage() {
  const store = useStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regimeFilter, setRegimeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all"); // "all", "company", "individual"
  const [finFilter, setFinFilter] = useState<Record<string, boolean>>({});
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const fetchCustomers = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId || tenantId.length < 5) return;

      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("tenant_id", tenantId);

        if (data) {
          data.forEach(c => {
            store.addDbCustomer({
              id: c.id,
              name: c.nome_fantasia,
              razaoSocial: c.razao_social || "",
              cnpj: c.cnpj || "",
              responsibleName: c.responsavel || "",
              whatsapp: c.whatsapp || "",
              phone: c.telefone || "",
              email: c.email || "",
              city: c.cidade || "",
              state: c.estado || "",
              regime: c.regime_tributario as any,
              naturezaJuridica: c.natureza_juridica || "",
              cnae: c.cnae || "",
              openingDate: c.opening_date ? new Date(c.opening_date) : undefined,
              hasEmployees: !!c.has_employees,
              employeeCount: c.employee_count || 0,
              status: c.status as any,
              priority: (c.prioridade || "Média") as any,
              serviceLevel: (c.service_level || "Padrão") as any,
              preferredChannel: (c.preferred_channel || "WhatsApp") as any,
              plan: c.plan || "",
              monthlyValue: c.monthly_value || 0,
              financialStatus: c.financial_status as any,
              origin: c.origin || "Direto",
              tenantId: c.tenant_id,
              contacts: [],
              tags: [],
              documents: [],
              driveFolderUrl: c.drive_folder_url || "",
              drivePayrollUrl: c.drive_payroll_url || "",
              driveBillingUrl: c.drive_billing_url || "",
              observations: c.observations || "",
              whatsapp_status: c.whatsapp_status || undefined,
              createdAt: new Date(c.created_at)
            });
          });
        }
      } catch (err) {
        console.error("Erro ao carregar clientes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [user?.tenantId]);

  const customers = store.customers;

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const anyFin = Object.values(finFilter).some(Boolean);
    return customers
      .filter(c => {
        const matchesSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.razaoSocial.toLowerCase().includes(q) ||
          (c.responsibleName || "").toLowerCase().includes(q) ||
          (!!digits && c.cnpj.replace(/\D/g, "").includes(digits));
        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
        const matchesRegime = regimeFilter === "all" || c.regime === regimeFilter;
        const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
        const matchesFin = !anyFin || !!finFilter[c.financialStatus || ""];
        const isCompany = !!c.cnpj && c.cnpj.trim().length > 0;
        const matchesType = typeFilter === "all" || (typeFilter === "company" ? isCompany : !isCompany);
        return matchesSearch && matchesStatus && matchesRegime && matchesPriority && matchesFin && matchesType;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [customers, search, statusFilter, regimeFilter, priorityFilter, finFilter, typeFilter]);

  const count = (fn: (c: Customer) => boolean) => customers.filter(fn).length;
  const activeCount = count(c => c.status === "Ativo");
  const onboardingCount = count(c => c.status === "Onboarding");
  const noWhatsapp = count(semWhatsapp);
  const hasFilters =
    statusFilter !== "all" || regimeFilter !== "all" || priorityFilter !== "all" || typeFilter !== "all" || !!search || Object.values(finFilter).some(Boolean);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRegimeFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setFinFilter({});
  };

  return (
    <div className="flex flex-col gap-5 px-8 pb-8">
      {noWhatsapp > 0 && (
        <HighlightBanner
          icon={<Users className="h-20 w-20" strokeWidth={1.3} />}
          big={noWhatsapp}
          bigLabel={noWhatsapp === 1 ? "cliente sem WhatsApp válido" : "clientes sem WhatsApp válido"}
          text="Sem um número verificado, o cliente fica fora dos avisos e envios em lote."
          action={
            <Link to="/contacts/hygiene" className="self-start rounded-full bg-card px-5 py-2 text-[13px] font-extrabold text-primary hover:opacity-90">
              Revisar contatos
            </Link>
          }
          aside={
            <>
              <span className="text-[13px] font-semibold leading-snug text-primary">Higienização: duplicados e dados incompletos</span>
              <Link
                to="/contacts/hygiene"
                aria-label="Abrir higienização de contatos"
                className="flex h-9 w-9 items-center justify-center self-end rounded-full bg-primary text-primary-foreground"
              >
                <CornerDownRight className="h-4 w-4" />
              </Link>
            </>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside aria-label="Filtros" className="flex flex-col gap-6">
          <label className="flex h-10 items-center gap-2 rounded-full bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nome, CNPJ ou responsável"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Search className="h-4 w-4 text-primary" />
          </label>

          <FilterGroup title="Regime">
            <div className="flex flex-wrap gap-1.5">
              {REGIMES.map(r => (
                <PillToggle key={r.key} active={regimeFilter === r.key} onClick={() => setRegimeFilter(r.key)}>
                  {r.label}
                </PillToggle>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Status">
            {["all", "Ativo", "Onboarding", "Inativo", "Encerrado"].map(st => (
              <FilterOption
                key={st}
                type="radio"
                name="cliente-status"
                label={st === "all" ? "Todos" : st}
                count={st === "all" ? customers.length : count(c => c.status === st)}
                checked={statusFilter === st}
                onChange={() => setStatusFilter(st)}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Financeiro">
            {["Adimplente", "Atenção", "Inadimplente"].map(f => (
              <FilterOption
                key={f}
                type="checkbox"
                label={f}
                count={count(c => c.financialStatus === f)}
                checked={!!finFilter[f]}
                onChange={() => setFinFilter(prev => ({ ...prev, [f]: !prev[f] }))}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Prioridade">
            <div className="flex flex-wrap gap-1.5">
              {["all", "Alta", "Média", "Baixa"].map(p => (
                <PillToggle key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
                  {p === "all" ? "Todas" : p}
                </PillToggle>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Tipo">
            <div className="flex flex-wrap gap-1.5">
              {([
                ["all", "Todos"],
                ["company", "Empresas"],
                ["individual", "Pessoas"],
              ] as const).map(([k, l]) => (
                <PillToggle key={k} active={typeFilter === k} onClick={() => setTypeFilter(k)}>
                  {l}
                </PillToggle>
              ))}
            </div>
          </FilterGroup>
        </aside>

        <section className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-base font-extrabold">
                {filteredCustomers.length} {filteredCustomers.length === 1 ? "cliente" : "clientes"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {activeCount} ativos · {onboardingCount} em onboarding
              </span>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  <FilterX className="h-3.5 w-3.5" />
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ContactImportDialog onSuccess={() => window.location.reload()} />
              <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-9 gap-1.5 px-4">
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Novo cliente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Novo cadastro de cliente</DialogTitle>
                    <CardDescription>Preencha os dados contábeis e de atendimento.</CardDescription>
                  </DialogHeader>
                  <div className="pt-4">
                    <CustomerForm
                      onSuccess={c => {
                        setIsNewDialogOpen(false);
                        navigate(`/customers/${c.id}`);
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {loading && customers.length === 0 ? (
            <div className="flex justify-center rounded-xl bg-card py-24">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-xl bg-card py-24 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2 min-[1800px]:grid-cols-3">
                {filteredCustomers.slice(0, limit).map(c => (
                  <li key={c.id}>
                    <Link
                      to={`/customers/${c.id}`}
                      className="flex h-full items-center gap-4 rounded-xl bg-card p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <InitialsAvatar name={c.name} shape="tile" size={88} />
                      <span className="flex min-w-0 flex-col gap-1.5">
                        <span className="flex flex-wrap gap-1.5">
                          {c.regime && <Chip tone="navy">{REGIME_SHORT[c.regime] ?? c.regime}</Chip>}
                          {c.status && <Chip tone={STATUS_TONE[c.status] ?? "grey"}>{c.status}</Chip>}
                          {c.priority === "Alta" && <Chip tone="red">Prioridade alta</Chip>}
                        </span>
                        <span className="truncate text-[15px] font-extrabold leading-snug">{c.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {c.cnpj ? `CNPJ ${c.cnpj}` : "Pessoa física"}
                          {c.responsibleName ? ` · ${c.responsibleName}` : ""}
                        </span>
                        <span className="mt-0.5 flex gap-2.5 text-xs">
                          {c.financialStatus && <span className={`font-bold ${FIN_CLASS[c.financialStatus] ?? ""}`}>{c.financialStatus}</span>}
                          {c.city && (
                            <span className="truncate text-muted-foreground">
                              {c.city}
                              {c.state ? `/${c.state}` : ""}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {filteredCustomers.length > limit && (
                <Button variant="outline" className="self-center" onClick={() => setLimit(l => l + PAGE)}>
                  Mostrar mais ({filteredCustomers.length - limit} restantes)
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
