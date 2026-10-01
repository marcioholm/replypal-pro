import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, type Conversation } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { InitialsAvatar, Chip } from "@/components/conta-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Inbox,
  Search,
  RefreshCw,
  Link2,
  Sparkles,
  Archive,
  ArrowUpDown,
  Phone,
  Clock,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { VincularClienteModal } from "@/components/triagem/VincularClienteModal";
import { EnviarPreVendaModal } from "@/components/triagem/EnviarPreVendaModal";
import { ArquivarConversaModal } from "@/components/triagem/ArquivarConversaModal";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TriagemPage() {
  const store = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [conversas, setConversas] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");

  // Modais de ação rápida por linha
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [modalVincular, setModalVincular] = useState(false);
  const [modalPreVenda, setModalPreVenda] = useState(false);
  const [modalArquivar, setModalArquivar] = useState(false);

  const fetchTriagem = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .eq("funil", "triagem")
        .order("last_message_time", { ascending: true }); // Mais antigas primeiro

      if (error) throw error;

      const formatted: Conversation[] = (data || []).map((c) => ({
        id: c.id,
        clientName: c.client_name || "Desconhecido",
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
        funil: c.funil,
        arquivoMotivo: c.arquivo_motivo,
      }));

      setConversas(formatted);
      store.addDbConversations(formatted);
    } catch (err: any) {
      console.error("Erro ao carregar triagem:", err);
      toast.error("Erro ao carregar mensagens em triagem.");
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, store]);

  useEffect(() => {
    fetchTriagem();
  }, [fetchTriagem]);

  const filteredConversas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.clientPhone.includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversas, search]);

  const handleAction = (conv: Conversation, action: "vincular" | "prevenda" | "arquivar") => {
    setActiveConv(conv);
    if (action === "vincular") setModalVincular(true);
    if (action === "prevenda") setModalPreVenda(true);
    if (action === "arquivar") setModalArquivar(true);
  };

  return (
    <div className="flex flex-col gap-5 px-8 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight">Triagem de Conversas</h1>
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-2 text-xs font-extrabold text-primary-foreground tabular">
              {conversas.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Números que entraram em contato sem cliente vinculado. Decida o destino para iniciar o atendimento.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone ou texto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-full text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTriagem}
            disabled={loading}
            className="h-9 gap-1.5 rounded-full text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Lista de triagem */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-xs font-bold text-muted-foreground">
          <span>CONTATO / MENSAGEM</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Mais antigas primeiro
            </span>
            <span>AÇÕES RÁPIDAS</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">Carregando triagem...</p>
          </div>
        ) : filteredConversas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-foreground">Triagem limpa!</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Nenhuma conversa aguardando classificação no momento. Todos os contatos recebidos estão vinculados a clientes ou leads.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredConversas.map((c) => {
              const tempoAberto = formatDistanceToNow(c.lastMessageTime, {
                addSuffix: true,
                locale: ptBR,
              });

              return (
                <li
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div
                    className="flex items-start gap-3.5 min-w-0 flex-1 cursor-pointer"
                    onClick={() => navigate(`/chat/${c.id}`)}
                  >
                    <InitialsAvatar name={c.clientName} src={c.clientAvatar} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">
                          {c.clientName}
                        </span>
                        {c.clientPhone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3" />
                            {c.clientPhone}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground/80 ml-auto sm:ml-2">
                          {tempoAberto}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {c.lastMessage || "Sem mensagens"}
                      </p>
                    </div>
                  </div>

                  {/* Ações em 1 clique */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-border font-semibold hover:bg-muted"
                      onClick={() => handleAction(c, "arquivar")}
                    >
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                      Não é cliente
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 font-semibold"
                      onClick={() => handleAction(c, "prevenda")}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      Possível cliente
                    </Button>

                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                      onClick={() => handleAction(c, "vincular")}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Vincular a cliente
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activeConv && (
        <>
          <VincularClienteModal
            open={modalVincular}
            onOpenChange={setModalVincular}
            conversaId={activeConv.id}
            telefone={activeConv.clientPhone}
            nomeContatoPadrao={activeConv.clientName}
            onSuccess={() => {
              setActiveConv(null);
              fetchTriagem();
            }}
          />

          <EnviarPreVendaModal
            open={modalPreVenda}
            onOpenChange={setModalPreVenda}
            conversaId={activeConv.id}
            nomeContatoPadrao={activeConv.clientName}
            onSuccess={() => {
              setActiveConv(null);
              fetchTriagem();
            }}
          />

          <ArquivarConversaModal
            open={modalArquivar}
            onOpenChange={setModalArquivar}
            conversaId={activeConv.id}
            onSuccess={() => {
              setActiveConv(null);
              fetchTriagem();
            }}
            onVincularClick={() => {
              setModalVincular(true);
            }}
          />
        </>
      )}
    </div>
  );
}
