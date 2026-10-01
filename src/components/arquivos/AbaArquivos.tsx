import { useState, useEffect, useCallback } from "react";
import { 
  FolderOpen, Lock, Unlock, ExternalLink, Send, ShieldAlert,
  Loader2, CheckCircle2, Clock, FileText, AlertCircle, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/conta-ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PedirAcessoDialog } from "./PedirAcessoDialog";
import DadosFinanceiros from "@/components/clientes/DadosFinanceiros";
import { sendMediaMessage } from "@/lib/evolution";

interface AbaArquivosProps {
  conversaId: string;
  clienteId?: string;
  clienteNome?: string;
  clienteCnpj?: string;
  clienteTelefone?: string;
  onVincularCliente?: () => void;
}

interface ClienteLink {
  id: string;
  area: string;
  titulo: string;
  url: string;
  ordem: number;
}

interface DocumentoCliente {
  id: string;
  cliente_id: string;
  categoria: string;
  tipo: string;
  mes: number | null;
  ano: number | null;
  url: string;
  nome_arquivo: string;
  uploaded_at: string;
  area: string;
  restrito: boolean;
}

const MESES_ABREV = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MESES_EXTENSO = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function AbaArquivos({
  conversaId,
  clienteId,
  clienteNome,
  clienteCnpj,
  clienteTelefone,
  onVincularCliente,
}: AbaArquivosProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<ClienteLink[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCliente[]>([]);
  const [faturamentoStatus, setFaturamentoStatus] = useState<{ lancado: boolean; mes: number; ano: number } | null>(null);
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({
    geral: true,
    fiscal: true,
    cartao_cnpj: true,
    rh: false,
    financeiro: false,
    certificado: false,
  });
  const [pedidosAcesso, setPedidosAcesso] = useState<Record<string, { status: string; expira_em?: string; resposta?: string }>>({});
  const [pedirAcessoArea, setPedirAcessoArea] = useState<"rh" | "financeiro" | "certificado" | null>(null);
  const [copiedCnpj, setCopiedCnpj] = useState(false);
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);
  const [sheetFinanceiroOpen, setSheetFinanceiroOpen] = useState(false);

  // 1. Carregar permissões das áreas restritas
  const checkPermissoes = useCallback(async () => {
    if (!user?.id || !clienteId) return;

    if (user.role === "admin" || user.role === "supervisor") {
      setPermissoes({
        geral: true,
        fiscal: true,
        cartao_cnpj: true,
        rh: true,
        financeiro: true,
        certificado: true,
      });
      return;
    }

    try {
      const areasRestritas = ["rh", "financeiro", "certificado"] as const;
      const results = await Promise.all(
        areasRestritas.map(async (area) => {
          const { data } = await supabase.rpc("usuario_tem_acesso", {
            p_usuario: user.id,
            p_cliente: clienteId,
            p_area: area,
          });
          return { area, temAcesso: !!data };
        })
      );

      const newPermissoes: Record<string, boolean> = {
        geral: true,
        fiscal: true,
        cartao_cnpj: true,
        rh: false,
        financeiro: false,
        certificado: false,
      };
      results.forEach((r) => {
        newPermissoes[r.area] = r.temAcesso;
      });
      setPermissoes(newPermissoes);

      // Buscar solicitações de acesso pendentes ou aprovadas recentes
      const { data: solData } = await supabase
        .from("solicitacoes_acesso")
        .select("area, status, expira_em, resposta")
        .eq("solicitante_id", user.id)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });

      if (solData) {
        const pedMap: Record<string, any> = {};
        for (const s of solData) {
          if (!pedMap[s.area]) {
            pedMap[s.area] = s;
          }
        }
        setPedidosAcesso(pedMap);
      }
    } catch (err) {
      console.error("Erro ao verificar permissões:", err);
    }
  }, [user?.id, user?.role, clienteId]);

  // 2. Carregar atalhos (cliente_links) e documentos recentes
  const fetchData = useCallback(async () => {
    if (!clienteId || !user?.tenantId) return;

    setLoading(true);
    try {
      const [linksRes, docsRes, fatRes] = await Promise.all([
        supabase
          .from("cliente_links")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("ordem", { ascending: true }),
        supabase
          .from("vw_documentos_cliente")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("uploaded_at", { ascending: false })
          .limit(8),
        supabase
          .from("vw_faturamento_status_mes")
          .select("*")
          .eq("cliente_id", clienteId)
          .maybeSingle(),
      ]);

      if (linksRes.data) setLinks(linksRes.data);
      if (docsRes.data) setDocumentos(docsRes.data as DocumentoCliente[]);
      if (fatRes.data) {
        setFaturamentoStatus({
          lancado: !!fatRes.data.lancado,
          mes: fatRes.data.mes,
          ano: fatRes.data.ano,
        });
      } else {
        const d = new Date();
        setFaturamentoStatus({ lancado: false, mes: d.getMonth() + 1, ano: d.getFullYear() });
      }
    } catch (err) {
      console.error("Erro ao carregar dados da aba arquivos:", err);
    } finally {
      setLoading(false);
    }
  }, [clienteId, user?.tenantId]);

  useEffect(() => {
    if (clienteId) {
      checkPermissoes();
      fetchData();
    }
  }, [clienteId, checkPermissoes, fetchData]);

  // 3. Realtime para solicitações de acesso (libera na hora se aprovado)
  useEffect(() => {
    if (!clienteId || !user?.id) return;

    const channel = supabase
      .channel(`acesso-realtime-${clienteId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solicitacoes_acesso",
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          checkPermissoes();
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, user?.id, checkPermissoes, fetchData]);

  // Auditoria: registrar visualização de documento / link
  const registrarAcesso = async (area: string, acao: string, docId?: string, linkId?: string) => {
    if (!user?.tenantId || !clienteId) return;
    try {
      await supabase.from("acessos_log").insert([
        {
          tenant_id: user.tenantId,
          usuario_id: user.id,
          cliente_id: clienteId,
          area,
          acao,
          documento_id: docId || null,
          link_id: linkId || null,
          conversa_id: conversaId || null,
        },
      ]);
    } catch (e) {
      console.error("Erro ao gravar acessos_log:", e);
    }
  };

  // Enviar documento no chat
  const handleEnviarNoChat = async (doc: DocumentoCliente) => {
    if (!clienteTelefone) {
      toast.error("Telefone do cliente não encontrado para envio");
      return;
    }

    setSendingDocId(doc.id);
    try {
      const caption = `Documento: ${doc.nome_arquivo || doc.tipo}`;
      const sent = await sendMediaMessage(
        clienteTelefone,
        doc.url,
        "document",
        doc.nome_arquivo || "documento.pdf",
        caption
      );

      if (sent) {
        await registrarAcesso(doc.area, "enviou_no_chat", doc.id);
        toast.success(`"${doc.nome_arquivo || doc.tipo}" enviado na conversa!`);
      } else {
        toast.error("Falha ao enviar documento pelo WhatsApp.");
      }
    } catch (err: any) {
      console.error("Erro ao enviar documento no chat:", err);
      toast.error(err.message || "Erro no envio do documento");
    } finally {
      setSendingDocId(null);
    }
  };

  // Se não houver cliente vinculado
  if (!clienteId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Esta conversa ainda não está ligada a um cliente</p>
          <p className="text-xs text-muted-foreground">
            Vincule ou cadastre a empresa para acessar arquivos, faturamento e cartões.
          </p>
        </div>
        {onVincularCliente && (
          <Button onClick={onVincularCliente} size="sm" className="gap-2">
            Vincular cliente
          </Button>
        )}
      </div>
    );
  }

  const mesAtualNome = faturamentoStatus ? MESES_EXTENSO[faturamentoStatus.mes] : "Mês atual";

  return (
    <div className="space-y-5 text-xs">
      {/* 1. Faturamento do Mês */}
      <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Faturamento do Mês</p>
              <p className="text-[11px] text-muted-foreground">
                {faturamentoStatus?.lancado ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {mesAtualNome} lançado
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {mesAtualNome} pendente
                  </span>
                )}
              </p>
            </div>
          </div>

          <div>
            {permissoes.financeiro ? (
              <Sheet open={sheetFinanceiroOpen} onOpenChange={setSheetFinanceiroOpen}>
                <SheetTrigger asChild>
                  <Button
                    size="sm"
                    variant={faturamentoStatus?.lancado ? "outline" : "default"}
                    className="h-8 text-xs font-semibold"
                    onClick={() => registrarAcesso("financeiro", "visualizou")}
                  >
                    {faturamentoStatus?.lancado ? "Ver / Editar" : "Lançar"}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader className="mb-4">
                    <SheetTitle>Dados Financeiros: {clienteNome}</SheetTitle>
                  </SheetHeader>
                  <DadosFinanceiros
                    clienteId={clienteId}
                    clienteNome={clienteNome || ""}
                    tenantId={user?.tenantId || ""}
                  />
                </SheetContent>
              </Sheet>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-amber-300 text-amber-700 dark:text-amber-300"
                onClick={() => setPedirAcessoArea("financeiro")}
              >
                <Lock className="w-3 h-3" />
                {pedidosAcesso.financeiro?.status === "pendente" ? "Aguardando" : "Pedir acesso"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Atalhos (cliente_links) */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          Atalhos do Cliente
        </p>

        {links.length === 0 ? (
          <p className="text-muted-foreground italic text-[11px] py-1">Nenhum atalho cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {links.map((link) => {
              const temAcesso = permissoes[link.area] ?? true;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate font-semibold text-foreground" title={link.titulo}>
                      {link.titulo}
                    </span>
                  </div>

                  {temAcesso ? (
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-primary"
                      onClick={() => registrarAcesso(link.area, "visualizou", undefined, link.id)}
                    >
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        Abrir
                      </a>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] text-amber-600 border-amber-300"
                      onClick={() => setPedirAcessoArea(link.area as any)}
                    >
                      <Lock className="w-2.5 h-2.5 mr-1" />
                      Pedir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Cartão CNPJ */}
      {clienteCnpj && (
        <div className="p-3 rounded-xl border bg-muted/10 flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold text-foreground">Cartão CNPJ</p>
            <p className="font-mono text-[11px] text-muted-foreground truncate">{clienteCnpj}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(clienteCnpj.replace(/\D/g, ""));
                setCopiedCnpj(true);
                toast.success("CNPJ copiado!");
                setTimeout(() => setCopiedCnpj(false), 2000);
              }}
            >
              {copiedCnpj ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              asChild
            >
              <a
                href="https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Receita
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* 4. Documentos Recentes (últimos 8) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Documentos Recentes ({documentos.length})
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : documentos.length === 0 ? (
          <p className="text-muted-foreground italic text-[11px] py-1">Nenhum documento encontrado.</p>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => {
              const temAcesso = permissoes[doc.area] ?? true;
              const isCertificado = doc.tipo === "certificado_digital" || doc.area === "certificado";
              const comp = doc.mes && doc.ano ? `${MESES_ABREV[doc.mes]}/${doc.ano}` : null;

              return (
                <div
                  key={doc.id}
                  className="p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate" title={doc.nome_arquivo}>
                        {doc.nome_arquivo || doc.tipo}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="capitalize">{doc.categoria || doc.tipo.replace(/_/g, " ")}</span>
                        {comp && <span>• {comp}</span>}
                        <span>• {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {!temAcesso && (
                      <Chip tone="amber" className="text-[10px]">
                        <Lock className="w-2.5 h-2.5" /> Restrito
                      </Chip>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                    {temAcesso ? (
                      <>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => registrarAcesso(doc.area, "visualizou", doc.id)}
                        >
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                          </a>
                        </Button>

                        {isCertificado ? (
                          <span
                            className="text-[10px] text-muted-foreground italic"
                            title="Certificado digital não pode ser enviado pelo chat por segurança"
                          >
                            Não enviável pelo chat
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-[11px] gap-1"
                            disabled={sendingDocId === doc.id}
                            onClick={() => handleEnviarNoChat(doc)}
                          >
                            {sendingDocId === doc.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Enviar na conversa
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {pedidosAcesso[doc.area]?.status === "pendente" ? (
                          <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Aguardando aprovação
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] border-amber-300 text-amber-700 dark:text-amber-300 gap-1"
                            onClick={() => setPedirAcessoArea(doc.area as any)}
                          >
                            <Lock className="w-3 h-3" /> Pedir acesso
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diálogo de Pedir Acesso */}
      {pedirAcessoArea && user?.id && clienteId && (
        <PedirAcessoDialog
          open={!!pedirAcessoArea}
          onOpenChange={(open) => !open && setPedirAcessoArea(null)}
          userId={user.id}
          clienteId={clienteId}
          clienteNome={clienteNome || ""}
          area={pedirAcessoArea}
          conversaId={conversaId}
          onSuccess={() => {
            checkPermissoes();
            fetchData();
          }}
        />
      )}
    </div>
  );
}
