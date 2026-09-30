import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, Clock, CornerDownRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useStore, formatRelativeTime, type Conversation, type SLAStatus } from "@/lib/store";
import { Chip, HighlightBanner, InitialsAvatar } from "@/components/conta-ui";
import { cn } from "@/lib/utils";

interface ClienteResumo {
  regime_tributario: string | null;
  financial_status: string | null;
  status: string | null;
}

const SLA_RANK: Record<SLAStatus, number> = { estourado: 0, em_risco: 1, ok: 2 };
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Próximo dia 20 (vencimento padrão do DAS do Simples Nacional). */
function nextDas(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), 20);
  if (today.getDate() > 20) d.setMonth(d.getMonth() + 1);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Linha crua vinda do Supabase (sem tipos gerados no projeto)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function mapConv(c: Row): Conversation {
  return {
    id: c.id,
    clientName: c.client_name || "Cliente",
    clientPhone: c.client_phone || "",
    customerId: c.customer_id,
    lastMessage: c.last_message || "",
    lastMessageTime: new Date(c.last_message_time || Date.now()),
    status: c.status || "novo",
    assignedTo: c.assigned_to,
    startedAt: c.started_at ? new Date(c.started_at) : undefined,
    slaDeadline: c.sla_deadline ? new Date(c.sla_deadline) : undefined,
    tenantId: c.tenant_id,
    tags: c.tags || [],
    clientAvatar: c.client_avatar,
    isGroup: c.is_group,
    protocolo: c.protocolo,
    resolvedAt: c.resolved_at,
  };
}

export default function HomePage() {
  const { user } = useAuth();
  const store = useStore();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    let cancelled = false;

    Promise.all([
      supabase
        .from("conversas")
        .select("id, client_name, client_phone, customer_id, last_message, last_message_time, status, assigned_to, started_at, sla_deadline, tenant_id, tags, client_avatar, is_group, protocolo, resolved_at")
        .eq("tenant_id", tenantId)
        .or(`status.neq.resolvido,resolved_at.gte.${since.toISOString()}`),
      supabase.from("clientes").select("regime_tributario, financial_status, status").eq("tenant_id", tenantId),
      store.users.length === 0
        ? supabase.from("usuarios").select("id, nome, email, role, tenant_id, avatar").eq("tenant_id", tenantId)
        : Promise.resolve({ data: null }),
    ]).then(([c, k, u]) => {
      if (cancelled) return;
      setConvs((c.data || []).map(mapConv).filter(x => !x.isGroup));
      setClientes((k.data as ClienteResumo[]) || []);
      if (u.data) {
        store.setUsers(
          (u.data as Row[]).map(d => ({
            id: d.id, name: d.nome, email: d.email, role: d.role, tenantId: d.tenant_id, avatar: d.avatar,
          }))
        );
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId]);

  const today = new Date();
  const open = useMemo(() => convs.filter(c => c.status !== "resolvido"), [convs]);
  const sla = (c: Conversation) => store.getSLAStatus(c);

  const fila = open.filter(c => !c.assignedTo);
  const emAtendimento = open.filter(c => !!c.assignedTo);
  const comigo = emAtendimento.filter(c => c.assignedTo === user?.id);
  const emRisco = open.filter(c => sla(c) !== "ok");
  const estourados = open.filter(c => sla(c) === "estourado");
  const resolvidas = convs.filter(c => c.status === "resolvido" && c.resolvedAt);
  const resolvidasHoje = resolvidas.filter(c => sameDay(new Date(c.resolvedAt!), today));

  const minhaFila = [...comigo, ...fila]
    .sort((a, b) => SLA_RANK[sla(a)] - SLA_RANK[sla(b)] || b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
    .slice(0, 5);
  const continuar = [...comigo].sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()).slice(0, 2);
  const riscoComigo = comigo.filter(c => sla(c) !== "ok");

  // Semana útil atual (seg–sex) com conversas resolvidas por dia
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d,
      count: resolvidas.filter(c => sameDay(new Date(c.resolvedAt!), d)).length,
      state: sameDay(d, today) ? "today" : d < today ? "past" : "future",
    };
  });

  const das = nextDas(today);
  const simples = clientes.filter(c => /simples|mei/i.test(c.regime_tributario || "") && c.status !== "Inativo" && c.status !== "Encerrado").length;
  const inadimplentes = clientes.filter(c => c.financial_status === "Inadimplente").length;
  const firstName = (user?.name || "").split(" ")[0];
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex flex-col gap-5 px-8 pb-8">
      <HighlightBanner
        icon={<CalendarDays className="h-24 w-24" strokeWidth={1.2} />}
        big={`${pad(das.getDate())}/${pad(das.getMonth() + 1)}`}
        bigLabel="DAS · Simples Nacional"
        text={
          loaded
            ? `${simples} ${simples === 1 ? "empresa" : "empresas"} do Simples Nacional e MEI na carteira ativa.`
            : "Carregando carteira..."
        }
        action={
          <Link
            to="/customers"
            className="self-start rounded-full bg-card px-5 py-2 text-[13px] font-extrabold text-primary transition-opacity hover:opacity-90"
          >
            Ver clientes
          </Link>
        }
        aside={
          <>
            <span className="text-[13px] font-semibold leading-snug text-primary">
              Confira todas as obrigações do mês no calendário fiscal
            </span>
            <Link
              to="/calendar"
              aria-label="Abrir calendário fiscal"
              className="flex h-10 w-10 items-center justify-center self-end rounded-full bg-primary text-primary-foreground"
            >
              <CornerDownRight className="h-[18px] w-[18px]" />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="text-[26px] font-extrabold tracking-tight">
                {greeting()}, {firstName}!
              </h2>
              <p className="mb-2 mt-1.5 text-sm text-muted-foreground">
                {comigo.length === 0
                  ? "Nenhuma conversa com você agora."
                  : `Você tem ${comigo.length} ${comigo.length === 1 ? "conversa em atendimento" : "conversas em atendimento"}`}
                {fila.length > 0 && ` e ${fila.length} na fila esperando alguém.`}
              </p>
              {riscoComigo.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  {riscoComigo.length} {riscoComigo.length === 1 ? "conversa sua perto" : "conversas suas perto"} de estourar o SLA ·{" "}
                  <Link to={`/chat/${riscoComigo[0].id}`} className="underline underline-offset-2">
                    responder agora
                  </Link>
                </span>
              )}
            </div>
            <div className="flex gap-2" aria-label="Conversas resolvidas por dia nesta semana">
              {week.map(d => (
                <div
                  key={d.date.toISOString()}
                  className={cn(
                    "flex w-[70px] flex-col items-center gap-1 rounded-2xl bg-card pb-2.5 pt-3",
                    d.state === "today" ? "ring-2 ring-primary" : "ring-1 ring-border"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular",
                      d.state === "future" ? "bg-muted text-muted-foreground" : d.count > 0 ? "bg-success text-success-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {d.state === "future" ? "–" : d.count}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {pad(d.date.getDate())}/{pad(d.date.getMonth() + 1)}
                  </span>
                  <span className="text-[13px] font-extrabold">{WEEKDAYS[d.date.getDay()]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl bg-card px-5 pb-1.5 pt-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-extrabold">Sua fila agora</h2>
              <Link to="/" className="text-[13px] font-bold text-primary hover:underline">
                Ver caixa de entrada
              </Link>
            </div>
            {minhaFila.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {loaded ? "Fila zerada. Nenhuma conversa esperando por você." : "Carregando..."}
              </p>
            ) : (
              <ul>
                {minhaFila.map((c, i) => {
                  const s = sla(c);
                  return (
                    <li key={c.id} className={cn(i < minhaFila.length - 1 && "border-b border-border")}>
                      <Link to={`/chat/${c.id}`} className="flex items-center gap-3.5 rounded-xl px-1 py-3 transition-colors hover:bg-muted/50">
                        <InitialsAvatar name={c.clientName} src={c.clientAvatar} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-bold">{c.clientName}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{c.lastMessage || "Sem mensagens"}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(c.lastMessageTime)}</span>
                          {s !== "ok" ? (
                            <Chip tone={s === "estourado" ? "red" : "amber"}>{s === "estourado" ? "SLA estourado" : "SLA em risco"}</Chip>
                          ) : c.assignedTo ? (
                            <Chip tone="green">No prazo</Chip>
                          ) : (
                            <Chip tone="soft">Na fila</Chip>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Na fila" value={fila.length} note="sem atendente" tone="text-primary" />
            <Kpi label="Em atendimento" value={emAtendimento.length} note={`${comigo.length} com você`} tone="text-primary" />
            <Kpi label="SLA em risco" value={emRisco.length} note={`${estourados.length} já estourado${estourados.length === 1 ? "" : "s"}`} tone="text-amber-700 dark:text-amber-300" />
            <Kpi label="Resolvidas hoje" value={resolvidasHoje.length} note={`${resolvidas.length} nos últimos 7 dias`} tone="text-success" />
          </div>

          {continuar.length > 0 && (
            <section className="flex flex-col gap-3.5 rounded-xl bg-card p-5">
              <div>
                <p className="text-[11px] text-muted-foreground">Continuar de onde parou</p>
                <h2 className="text-[15px] font-extrabold">Suas conversas mais recentes</h2>
              </div>
              <div className="flex gap-3">
                {continuar.map(c => (
                  <Link key={c.id} to={`/chat/${c.id}`} className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="relative">
                      <InitialsAvatar name={c.clientName} src={c.clientAvatar} shape="tile" size={92} className="!w-full !rounded-[14px]" />
                      <span className="absolute bottom-2 right-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <CornerDownRight className="h-3.5 w-3.5" />
                      </span>
                    </span>
                    <span className="truncate text-xs font-bold">{c.clientName}</span>
                    <span className="-mt-1.5 truncate text-[11px] text-muted-foreground">{c.lastMessage}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-xl bg-card p-5">
            <h2 className="text-[15px] font-extrabold">Alertas</h2>
            {estourados.length === 0 && inadimplentes === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nada fora do normal agora.</p>
            ) : (
              <>
                {estourados.slice(0, 3).map(c => (
                  <Link key={c.id} to={`/chat/${c.id}`} className="flex items-start gap-2.5 text-[13px] leading-snug hover:underline">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>
                      <b>{c.clientName}</b> passou do prazo de resposta ({formatRelativeTime(c.lastMessageTime)}).
                    </span>
                  </Link>
                ))}
                {inadimplentes > 0 && (
                  <Link to="/customers" className="flex items-start gap-2.5 text-[13px] leading-snug hover:underline">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      <b>
                        {inadimplentes} {inadimplentes === 1 ? "cliente inadimplente" : "clientes inadimplentes"}
                      </b>{" "}
                      na carteira.
                    </span>
                  </Link>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card px-[18px] py-4">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={cn("text-[30px] font-extrabold leading-tight tracking-tight tabular", tone)}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{note}</span>
    </div>
  );
}
