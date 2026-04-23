import { useStore, MOCK_USERS, formatDuration, ensureDate } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  MessageSquare, UserX, CheckCircle, Users, 
  Clock, AlertTriangle, Trophy, Timer, 
  TrendingUp, Cake, CalendarDays, ArrowUpRight, 
  Activity, BarChart3
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

export default function DashboardPage() {
  const store = useStore();
  const convs = store.conversations;
  const customers = store.customers;

  const open = convs.filter((c) => c.status !== "resolvido");
  const unassigned = convs.filter((c) => !c.assignedTo && c.status !== "resolvido");
  const resolvedToday = convs.filter((c) => {
    if (c.status !== "resolvido") return false;
    const today = new Date();
    return c.lastMessageTime.toDateString() === today.toDateString();
  });
  const atRisk = convs.filter((c) => {
    const sla = store.getSLAStatus(c);
    return sla === "em_risco" || sla === "estourado";
  });

  // Anniversaries logic
  const today = new Date();
  const currentMonth = today.getMonth();
  
  const foundationAnniversaries = customers.filter(c => {
    const d = ensureDate(c.openingDate);
    return d && d.getMonth() === currentMonth;
  }).map(c => {
    const d = ensureDate(c.openingDate)!;
    return {
      ...c,
      years: today.getFullYear() - d.getFullYear(),
      day: d.getDate(),
      type: 'foundation'
    };
  }).sort((a, b) => a.day - b.day);

  const serviceAnniversaries = customers.filter(c => {
    const d = ensureDate(c.startDate);
    return d && d.getMonth() === currentMonth;
  }).map(c => {
    const d = ensureDate(c.startDate)!;
    return {
      ...c,
      years: today.getFullYear() - d.getFullYear(),
      day: d.getDate(),
      type: 'service'
    };
  }).sort((a, b) => a.day - b.day);

  // Average response time (mock: based on startedAt)
  const withStart = convs.filter((c) => c.startedAt);
  const avgResponseMin = withStart.length > 0
    ? Math.round(withStart.reduce((sum, c) => {
        const diff = (c.lastMessageTime.getTime() - c.startedAt!.getTime()) / 60000;
        return sum + Math.abs(diff);
      }, 0) / withStart.length)
    : 0;

  // Average resolution time (resolved only)
  const resolved = convs.filter((c) => c.status === "resolvido" && c.startedAt);
  const avgResolutionMin = resolved.length > 0
    ? Math.round(resolved.reduce((sum, c) => {
        const diff = (c.lastMessageTime.getTime() - c.startedAt!.getTime()) / 60000;
        return sum + Math.abs(diff);
      }, 0) / resolved.length)
    : 0;

  const perUser = MOCK_USERS.map((u) => {
    const userConvs = convs.filter((c) => c.assignedTo === u.id);
    const active = userConvs.filter((c) => c.status !== "resolvido").length;
    const resolvedCount = userConvs.filter((c) => c.status === "resolvido").length;
    const total = userConvs.length;
    const avgTime = userConvs.filter((c) => c.startedAt).length > 0
      ? Math.round(userConvs.filter((c) => c.startedAt).reduce((sum, c) => sum + Math.abs(c.lastMessageTime.getTime() - c.startedAt!.getTime()) / 60000, 0) / userConvs.filter((c) => c.startedAt).length)
      : 0;
    return { ...u, active, resolvedCount, total, avgTime };
  }).sort((a, b) => b.resolvedCount - a.resolvedCount);

  const stats = [
    { label: "Conversas abertas", value: open.length, icon: MessageSquare, color: "text-info" },
    { label: "Sem responsável", value: unassigned.length, icon: UserX, color: "text-warning" },
    { label: "Resolvidas hoje", value: resolvedToday.length, icon: CheckCircle, color: "text-success" },
    { label: "SLA em risco", value: atRisk.length, icon: AlertTriangle, color: "text-destructive" },
    { label: "Tempo médio resposta", value: `${avgResponseMin}min`, icon: Timer, color: "text-primary" },
    { label: "Tempo médio resolução", value: `${avgResolutionMin}min`, icon: TrendingUp, color: "text-accent-foreground" },
  ];

  const statusDistribution = [
    { label: "Novos", count: convs.filter((c) => c.status === "novo").length, color: "hsl(215 60% 50%)" },
    { label: "Aguardando aceite", count: convs.filter((c) => c.status === "aguardando_aceite").length, color: "hsl(38 72% 50%)" },
    { label: "Em atendimento", count: convs.filter((c) => c.status === "em_atendimento").length, color: "hsl(215 60% 32%)" },
    { label: "Aguardando cliente", count: convs.filter((c) => c.status === "aguardando_cliente").length, color: "hsl(280 40% 48%)" },
    { label: "Resolvidos", count: convs.filter((c) => c.status === "resolvido").length, color: "hsl(152 56% 38%)" },
  ];

  const activityData = [
    { day: "Seg", conversations: 12, resolved: 8 },
    { day: "Ter", conversations: 19, resolved: 15 },
    { day: "Qua", conversations: 14, resolved: 11 },
    { day: "Qui", conversations: 22, resolved: 18 },
    { day: "Sex", conversations: 17, resolved: 14 },
    { day: "Sáb", conversations: 6, resolved: 5 },
    { day: "Dom", conversations: 3, resolved: 2 },
  ];

  const chartConfig = {
    conversations: { label: "Conversas", color: "hsl(215 60% 50%)" },
    resolved: { label: "Resolvidas", color: "hsl(152 56% 38%)" },
  };

  const total = convs.length || 1;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent italic">Relatórios Operacionais</h1>
           <p className="text-muted-foreground">Monitoramento em tempo real do atendimento contábil.</p>
        </div>
        <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-lg border border-border/50">
           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-md shadow-sm border border-border/50">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sistema Live</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="hover:shadow-md transition-all border-none shadow-xl shadow-primary/5 group">
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <span className="text-2xl font-black italic tracking-tighter">{s.value}</span>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-wider font-mono">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/20 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              Volume de Atendimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={chartConfig} className="h-[200px]">
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(215 60% 50%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(215 60% 50%)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152 56% 38%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(152 56% 38%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(220 10% 44%)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(220 10% 44%)' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="conversations" stroke="hsl(215 60% 50%)" fill="url(#colorConversations)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="resolved" stroke="hsl(152 56% 38%)" fill="url(#colorResolved)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/20 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between h-[200px] gap-4">
              <div className="flex-1 space-y-3">
                {statusDistribution.map((s) => (
                  <div key={s.label} className="group cursor-default">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-muted-foreground">{s.label}</span>
                      <span className="text-[10px] font-bold">{s.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500 group-hover:opacity-80" 
                        style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {statusDistribution.reduce((acc, s, i) => {
                    const offset = acc.offset;
                    const circumference = 2 * Math.PI * 40;
                    const segmentLength = (s.count / total) * circumference;
                    acc.elements.push(
                      <circle 
                        key={s.label}
                        cx="50" cy="50" r="40" 
                        fill="none" 
                        stroke={s.color} 
                        strokeWidth="12"
                        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                        strokeDashoffset={-offset}
                        className="transition-all duration-500"
                      />
                    );
                    acc.offset += segmentLength;
                    return acc;
                  }, { offset: 0, elements: [] as React.ReactNode[] }).elements}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-xl font-bold">{total}</span>
                    <p className="text-[8px] text-muted-foreground uppercase">Total</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ranking de atendentes */}
        <Card className="animate-fade-in lg:col-span-2 border-none shadow-xl shadow-primary/5 overflow-hidden">
          <CardHeader className="pb-3 bg-muted/20 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" />
                Performance da Equipe
              </div>
              <ArrowUpRight className="w-4 h-4 opacity-50" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Rank</th>
                    <th className="text-left py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Atendente</th>
                    <th className="text-center py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Fila</th>
                    <th className="text-center py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Resolvidos</th>
                    <th className="text-center py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Eficiência</th>
                  </tr>
                </thead>
                <tbody>
                  {perUser.map((u, i) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-all group">
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black italic border ${
                          i === 0 ? "bg-warning/10 text-warning border-warning/30" : i === 1 ? "bg-muted text-muted-foreground border-border" : i === 2 ? "bg-accent/10 text-accent-foreground border-accent/30" : "text-muted-foreground border-transparent"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium">{u.name}</td>
                      <td className="text-center py-4 px-4"><span className="font-bold">{u.active}</span></td>
                      <td className="text-center py-4 px-4">
                        <span className="inline-flex items-center justify-center bg-success/10 text-success px-2 py-1 rounded-md font-bold text-[10px] border border-success/20">
                          {u.resolvedCount}
                        </span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-[10px]">{u.avgTime > 0 ? `${u.avgTime}min` : "—"}</span>
                          <div className="w-full max-w-[60px] h-1 bg-muted rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-primary" style={{ width: `${Math.min(100, (u.resolvedCount / 10) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Anniversaries Column */}
        <div className="space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5 bg-gradient-to-br from-card to-muted/20 animate-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                <Cake className="w-4 h-4" />
                Eventos do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-[0.2em]">Pilar Fundação (Empresa)</h3>
                {foundationAnniversaries.length === 0 ? (
                  <p className="text-[10px] italic text-muted-foreground opacity-50 py-2">Nenhum aniversário este mês.</p>
                ) : (
                  foundationAnniversaries.map((anniv) => (
                    <div key={anniv.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/40 hover:border-primary/30 transition-all group">
                       <div className="flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-lg bg-primary/5 flex flex-col items-center justify-center border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                             <span className="text-[8px] font-bold uppercase leading-none">Abr</span>
                             <span className="text-sm font-black italic">{anniv.day}</span>
                          </div>
                          <div className="min-w-0">
                             <p className="text-xs font-bold truncate">{anniv.name}</p>
                             <p className="text-[10px] text-muted-foreground">{anniv.years} anos de história</p>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                       </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-[0.2em]">Pilar Parceria (Serviço)</h3>
                {serviceAnniversaries.length === 0 ? (
                  <p className="text-[10px] italic text-muted-foreground opacity-50 py-2">Nenhum aniversário este mês.</p>
                ) : (
                  serviceAnniversaries.map((anniv) => (
                    <div key={anniv.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/40 hover:border-success/30 transition-all group">
                       <div className="flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-lg bg-success/5 flex flex-col items-center justify-center border border-success/10 group-hover:bg-success group-hover:text-success-foreground transition-colors shrink-0">
                             <span className="text-[8px] font-bold uppercase leading-none">Abr</span>
                             <span className="text-sm font-black italic">{anniv.day}</span>
                          </div>
                          <div className="min-w-0">
                             <p className="text-xs font-bold truncate">{anniv.name}</p>
                             <p className="text-[10px] text-muted-foreground">{anniv.years} anos de confiança</p>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-success/10 hover:text-success">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                       </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
