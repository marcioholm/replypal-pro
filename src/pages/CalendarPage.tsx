import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle, 
  Calculator, Briefcase, Plus, Trash2, Save
} from "lucide-react";
import { toast } from "sonner";

type ObligationType = "federal" | "estadual" | "municipal" | "outro";

interface Obligation {
  id: string;
  name: string;
  deadline: Date;
  type: ObligationType;
  description: string;
}

const typeColors = {
  federal: "bg-blue-500/10 text-blue-600 border-blue-200",
  estadual: "bg-green-500/10 text-green-600 border-green-200",
  municipal: "bg-purple-500/10 text-purple-600 border-purple-200",
  outro: "bg-gray-500/10 text-gray-600 border-gray-200",
};

interface NewObligation {
  name: string;
  deadline: string;
  type: "federal" | "estadual" | "municipal" | "outro";
  description: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [obligations, setObligations] = useState<Obligation[]>([
    { id: "1", name: "EFD-Contribuições", deadline: new Date(2024, 3, 15), type: "federal", description: "Escrituração Fiscal Digital" },
    { id: "2", name: "Simples Nacional - DAS", deadline: new Date(2024, 3, 25), type: "federal", description: "Documento de Arrecadação" },
    { id: "3", name: "FGTS - GFIP", deadline: new Date(2024, 4, 7), type: "federal", description: "Guia de Informações à Previdência" },
    { id: "4", name: "DIRF", deadline: new Date(2024, 3, 28), type: "federal", description: "Declaração de IRRF" },
  ]);
  
  const [newObligation, setNewObligation] = useState<NewObligation>({
    name: "",
    deadline: "",
    type: "federal",
    description: ""
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDay }, (_, i) => i);

  const getObligationsForDay = (day: number) => {
    return obligations.filter(o => 
      o.deadline.getDate() === day && 
      o.deadline.getMonth() === currentMonth &&
      o.deadline.getFullYear() === currentYear
    );
  };

  const upcomingObligations = obligations
    .filter(o => o.deadline >= today)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 5);

  const overdueObligations = obligations.filter(o => o.deadline < today);

  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const handleAddObligation = () => {
    if (!newObligation.name || !newObligation.deadline) {
      toast.error("Preencha o nome e a data");
      return;
    }

    const obligation: Obligation = {
      id: Math.random().toString(),
      name: newObligation.name,
      deadline: new Date(newObligation.deadline),
      type: newObligation.type,
      description: newObligation.description
    };

    setObligations([...obligations, obligation]);
    setNewObligation({ name: "", deadline: "", type: "federal", description: "" });
    setDialogOpen(false);
    toast.success("Obrigação adicionada com sucesso!");
  };

  const handleDeleteObligation = (id: string) => {
    setObligations(obligations.filter(o => o.id !== id));
    toast.success("Obrigação removida");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Calendar className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendário Fiscal</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              Gerencie obrigações e prazos do escritório contábil
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Obrigação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Obrigação Fiscal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nome da Obrigação *</Label>
                <Input 
                  placeholder="Ex: EFD-Contribuições" 
                  value={newObligation.name}
                  onChange={(e) => setNewObligation({...newObligation, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Vencimento *</Label>
                  <Input 
                    type="date" 
                    value={newObligation.deadline}
                    onChange={(e) => setNewObligation({...newObligation, deadline: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select 
                    value={newObligation.type}
                    onValueChange={(v) => setNewObligation({...newObligation, type: v as ObligationType})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="federal">Federal</SelectItem>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="municipal">Municipal</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea 
                  placeholder="Descrição ou observações..." 
                  value={newObligation.description}
                  onChange={(e) => setNewObligation({...newObligation, description: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddObligation} className="gap-1">
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  {monthNames[currentMonth]} {currentYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {paddingDays.map(i => (
                  <div key={`pad-${i}`} className="h-24 rounded-lg bg-muted/30" />
                ))}
                {days.map(day => {
                  const dayObligations = getObligationsForDay(day);
                  const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
                  const isOverdue = dayObligations.some(o => o.deadline < today);

                  return (
                    <div 
                      key={day} 
                      className={`h-24 rounded-lg border p-2 transition-all hover:border-primary/30 cursor-pointer ${
                        isToday ? "bg-primary/5 border-primary" : "bg-card border-border/50 hover:bg-muted/30"
                      }`}
                      onClick={() => dayObligations.length > 0 && toast.info(`${dayObligations.length} obrigações neste dia`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{day}</span>
                        {dayObligations.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                          }`}>
                            {dayObligations.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        {dayObligations.slice(0, 2).map(o => (
                          <div 
                            key={o.id}
                            className={`text-[9px] px-1.5 py-0.5 rounded truncate ${
                              o.deadline < today 
                                ? "bg-destructive/10 text-destructive" 
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {o.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader className="pb-3 bg-muted/20 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Próximos Prazos
              </CardTitle>
              <span className="text-xs text-muted-foreground">{obligations.length} total</span>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 max-h-[400px] overflow-auto">
              {upcomingObligations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma obrigação cadastrada</p>
              ) : (
                upcomingObligations.map(o => {
                  const daysUntil = Math.ceil((o.deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={o.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors group">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold">{o.name}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteObligation(o.id)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{o.description}</p>
                      <div className="flex items-center gap-2 text-[10px]">
                        <Badge variant="outline" className={`text-[9px] ${typeColors[o.type]}`}>
                          {o.type}
                        </Badge>
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">
                          {o.deadline.toLocaleDateString('pt-BR')}
                        </span>
                        <span className={daysUntil <= 3 ? "text-destructive font-bold" : "text-muted-foreground"}>
                          ({daysUntil}d)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {overdueObligations.length > 0 && (
            <Card className="border-none shadow-xl shadow-destructive/5">
              <CardHeader className="pb-3 bg-destructive/5 border-b border-destructive/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  Atrasadas ({overdueObligations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {overdueObligations.map(o => (
                  <div key={o.id} className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm font-semibold text-destructive">{o.name}</p>
                    <p className="text-xs text-destructive/70 mt-1">
                      Venceu em {o.deadline.toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-xl shadow-primary/5">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                Resumo do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {obligations.filter(o => o.type === "federal" && o.deadline.getMonth() === currentMonth).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Federais</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {obligations.filter(o => o.type === "estadual" && o.deadline.getMonth() === currentMonth).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Estaduais</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {obligations.filter(o => o.type === "municipal" && o.deadline.getMonth() === currentMonth).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Municipais</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">
                    {obligations.filter(o => o.deadline.getMonth() === currentMonth).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}