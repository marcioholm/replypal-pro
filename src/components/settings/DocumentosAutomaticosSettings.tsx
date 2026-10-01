import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip, type ChipTone } from "@/components/conta-ui";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, FileText, CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/store";

interface DocumentoTipoConfig {
  id: string;
  tipo: string;
  rotulo: string;
  nivel: "automatico" | "um_clique" | "aprovacao_admin" | "nunca";
  somente_mes_atual: boolean;
  ativo: boolean;
}

interface PedidoDocumento {
  id: string;
  conversa_id: string;
  telefone: string;
  tipo: string;
  status: string;
  created_at: string;
  mensagem_cliente?: string;
  empresa?: string;
  contato_nome?: string;
  rotulo?: string;
}

const NIVEL_LABEL: Record<string, string> = {
  automatico: "Automático (bot envia)",
  um_clique: "Um clique (atendente envia)",
  aprovacao_admin: "Aprovação do admin",
  nunca: "Nunca (chama atendente)",
};

const STATUS_PEDIDO_TONE: Record<string, ChipTone> = {
  enviado: "green",
  aguardando_envio: "amber",
  aguardando_admin: "red",
  aguardando_cliente: "soft",
  recusado: "red",
  sem_documento: "grey",
  nao_autorizado: "grey",
  bloqueado: "grey",
  cancelado: "grey",
};

export default function DocumentosAutomaticosSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingBotAtivo, setSavingBotAtivo] = useState(false);
  const [botAtivo, setBotAtivo] = useState(false);
  const [tiposConfig, setTiposConfig] = useState<DocumentoTipoConfig[]>([]);
  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoDocumento[]>([]);
  const [updatingTipo, setUpdatingTipo] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.tenantId) return;

    setLoading(true);
    try {
      // 1. Carregar company_settings.bot_documentos_ativo
      const { data: setRes } = await supabase
        .from("company_settings")
        .select("bot_documentos_ativo")
        .eq("tenant_id", user.tenantId)
        .maybeSingle();

      if (setRes) {
        setBotAtivo(!!setRes.bot_documentos_ativo);
      }

      // 2. Carregar documento_tipos_config
      const { data: tiposRes } = await supabase
        .from("documento_tipos_config")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .order("rotulo", { ascending: true });

      if (tiposRes) {
        setTiposConfig(tiposRes as DocumentoTipoConfig[]);
      }

      // 3. Carregar pedidos dos últimos 30 dias
      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pedidosRes } = await supabase
        .from("pedidos_documento")
        .select(`
          id, conversa_id, telefone, tipo, status, created_at, mensagem_cliente,
          clientes!cliente_id(nome_fantasia),
          contatos!contato_id(nome)
        `)
        .eq("tenant_id", user.tenantId)
        .gte("created_at", trintaDiasAtras)
        .order("created_at", { ascending: false })
        .limit(50);

      if (pedidosRes) {
        setPedidosRecentes(pedidosRes.map((p: any) => ({
          id: p.id,
          conversa_id: p.conversa_id,
          telefone: p.telefone,
          tipo: p.tipo,
          status: p.status,
          created_at: p.created_at,
          mensagem_cliente: p.mensagem_cliente,
          empresa: p.clientes?.nome_fantasia || "—",
          contato_nome: p.contatos?.nome || "Contato",
        })));
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de documentos:", err);
      toast.error("Erro ao carregar configurações de documentos automáticos");
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleBotAtivo = async (ativo: boolean) => {
    if (!user?.tenantId) return;
    setSavingBotAtivo(true);
    try {
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          tenant_id: user.tenantId,
          bot_documentos_ativo: ativo,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });

      if (error) throw error;
      setBotAtivo(ativo);
      toast.success(ativo ? "Atendimento automático de documentos ATIVADO!" : "Atendimento automático de documentos PAUSADO.");
    } catch (e: any) {
      toast.error("Erro ao atualizar status: " + e.message);
    } finally {
      setSavingBotAtivo(false);
    }
  };

  const handleChangeNivel = async (tipoId: string, tipo: string, novoNivel: any) => {
    // Certificado nunca pode ser automático nem um clique
    if (tipo === "certificado_digital" && ["automatico", "um_clique"].includes(novoNivel)) {
      toast.error("Por segurança, certificado digital só pode ser 'Aprovação do admin' ou 'Nunca'.");
      return;
    }

    setUpdatingTipo(tipoId);
    try {
      const { error } = await supabase
        .from("documento_tipos_config")
        .update({ nivel: novoNivel, updated_at: new Date().toISOString() })
        .eq("id", tipoId);

      if (error) throw error;

      setTiposConfig(prev => prev.map(t => t.id === tipoId ? { ...t, nivel: novoNivel } : t));
      toast.success("Nível atualizado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar nível: " + e.message);
    } finally {
      setUpdatingTipo(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando configurações de documentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Liga / Desliga Principal */}
      <Card className="rounded-xl border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Atendimento Automático de Documentos
              </CardTitle>
              <CardDescription className="text-xs">
                Permite que clientes peçam documentos pelo WhatsApp ("me manda o cartão CNPJ", etc).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={botAtivo}
                onCheckedChange={handleToggleBotAtivo}
                disabled={savingBotAtivo || user?.role !== "admin"}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                {botAtivo ? "Ativo" : "Desligado"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Quando ativo, apenas contatos cadastrados e marcados com <strong>"Pode receber documentos"</strong> receberão respostas.
            Sem o cadastro, o bot direciona o cliente para a equipe.
          </p>
        </CardContent>
      </Card>

      {/* 2. Níveis por Tipo de Documento */}
      <Card className="rounded-xl border bg-card">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold">Níveis de Envio por Tipo de Documento</CardTitle>
          <CardDescription className="text-xs">
            Configure se o bot envia direto, avisa a atendente para envio em um clique ou exige aprovação prévia.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Documento</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead className="w-[240px]">Nível de Envio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiposConfig.map((item) => {
                const isCert = item.tipo === "certificado_digital";
                return (
                  <TableRow key={item.id} className="text-xs">
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        {isCert ? <ShieldCheck className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                        <span>{item.rotulo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.somente_mes_atual ? "Mês atual / anterior" : "Versão vigente"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.nivel}
                        onValueChange={(val) => handleChangeNivel(item.id, item.tipo, val)}
                        disabled={updatingTipo === item.id || user?.role !== "admin"}
                      >
                        <SelectTrigger className="h-8 text-xs font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {!isCert && (
                            <>
                              <SelectItem value="automatico" className="text-xs">
                                Automático (o bot envia)
                              </SelectItem>
                              <SelectItem value="um_clique" className="text-xs">
                                Um clique (atendente envia)
                              </SelectItem>
                            </>
                          )}
                          <SelectItem value="aprovacao_admin" className="text-xs">
                            Aprovação do admin
                          </SelectItem>
                          <SelectItem value="nunca" className="text-xs">
                            Nunca (passa para atendente)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 3. Pedidos dos Últimos 30 Dias */}
      <Card className="rounded-xl border bg-card">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Pedidos dos Últimos 30 Dias ({pedidosRecentes.length})</CardTitle>
            <CardDescription className="text-xs">
              Histórico de solicitações de documentos recebidas pelo WhatsApp.
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {pedidosRecentes.length === 0 ? (
            <p className="text-xs text-muted-foreground p-6 text-center italic">
              Nenhum pedido de documento registrado nos últimos 30 dias.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa / Contato</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Mensagem do Cliente</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosRecentes.map((ped) => (
                  <TableRow key={ped.id} className="text-xs">
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(new Date(ped.created_at))}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{ped.empresa}</div>
                      <div className="text-[10px] text-muted-foreground">{ped.contato_nome} • {ped.telefone}</div>
                    </TableCell>
                    <TableCell className="font-medium capitalize">
                      {ped.tipo.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate italic text-muted-foreground">
                      "{ped.mensagem_cliente || "—"}"
                    </TableCell>
                    <TableCell>
                      <Chip tone={STATUS_PEDIDO_TONE[ped.status] || "grey"}>
                        {ped.status.replace(/_/g, " ")}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
