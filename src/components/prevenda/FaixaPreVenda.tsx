import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, XCircle, Sparkles, Building, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { GanhoClienteModal } from "@/components/prevenda/GanhoClienteModal";
import { MotivoPerdaModal } from "@/components/prevenda/MotivoPerdaModal";

interface FaixaPreVendaProps {
  conversaId: string;
  onAtualizado: () => void;
}

export function FaixaPreVenda({ conversaId, onAtualizado }: FaixaPreVendaProps) {
  const { user } = useAuth();
  const [oportunidade, setOportunidade] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalGanho, setModalGanho] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);
  const [submittingPerda, setSubmittingPerda] = useState(false);

  const fetchOportunidade = async () => {
    if (!conversaId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("oportunidades")
        .select("*")
        .eq("conversa_id", conversaId)
        .not("etapa", "in", '("ganho","perdido")')
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setOportunidade(data);
      } else {
        setOportunidade(null);
      }
    } catch (e) {
      console.error("[FaixaPreVenda] Erro ao carregar oportunidade:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOportunidade();
  }, [conversaId]);

  const handleConfirmarPerda = async (motivo: string) => {
    if (!oportunidade || !user?.id) return;
    try {
      setSubmittingPerda(true);
      const { error } = await supabase.rpc("mover_oportunidade", {
        p_oportunidade: oportunidade.id,
        p_usuario: user.id,
        p_etapa: "perdido",
        p_motivo_perda: motivo,
      });

      if (error) throw error;
      toast.success("Oportunidade arquivada como perdida.");
      setModalPerda(false);
      onAtualizado();
    } catch (err: any) {
      console.error("Erro ao registrar perda:", err);
      toast.error(err.message || "Erro ao registrar perda");
    } finally {
      setSubmittingPerda(false);
    }
  };

  const handleConfirmarGanho = async (clienteId: string) => {
    if (!oportunidade || !user?.id) return;
    try {
      const { error } = await supabase.rpc("mover_oportunidade", {
        p_oportunidade: oportunidade.id,
        p_usuario: user.id,
        p_etapa: "ganho",
        p_cliente: clienteId,
      });

      if (error) throw error;
      toast.success("Oportunidade ganha! Conversa enviada para Atendimento.");
      setModalGanho(false);
      onAtualizado();
    } catch (err: any) {
      console.error("Erro ao registrar ganho:", err);
      toast.error(err.message || "Erro ao registrar ganho");
    }
  };

  if (loading) return null;
  if (!oportunidade) return null;

  const etapaNome: Record<string, string> = {
    novo_lead: "Novo Lead",
    qualificacao: "Qualificação",
    proposta_enviada: "Proposta Enviada",
    negociacao: "Negociação",
  };

  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/30 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-foreground">
                Em Pré-venda: {oportunidade.empresa_nome || oportunidade.nome_contato}
              </p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold uppercase">
                {etapaNome[oportunidade.etapa] || oportunidade.etapa}
              </span>
              {oportunidade.valor_mensal_estimado > 0 && (
                <span className="text-[11px] font-extrabold text-emerald-600">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(oportunidade.valor_mensal_estimado)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Você pode finalizar a negociação direto por aqui sem precisar arrastar no Kanban.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
            onClick={() => setModalPerda(true)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Marcar Perdido
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
            onClick={() => setModalGanho(true)}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-200" />
            Marcar Ganho
          </Button>
        </div>
      </div>

      <GanhoClienteModal
        open={modalGanho}
        onOpenChange={setModalGanho}
        oportunidade={oportunidade}
        onSuccess={handleConfirmarGanho}
      />

      <MotivoPerdaModal
        open={modalPerda}
        onOpenChange={setModalPerda}
        onConfirm={handleConfirmarPerda}
        loading={submittingPerda}
      />
    </>
  );
}
