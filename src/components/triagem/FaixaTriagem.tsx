import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Sparkles, Archive } from "lucide-react";
import { VincularClienteModal } from "./VincularClienteModal";
import { EnviarPreVendaModal } from "./EnviarPreVendaModal";
import { ArquivarConversaModal } from "./ArquivarConversaModal";

interface FaixaTriagemProps {
  conversaId: string;
  telefone?: string;
  nomeCliente?: string;
  onAtualizado: () => void;
}

export function FaixaTriagem({
  conversaId,
  telefone = "",
  nomeCliente = "",
  onAtualizado,
}: FaixaTriagemProps) {
  const [modalVincular, setModalVincular] = useState(false);
  const [modalPreVenda, setModalPreVenda] = useState(false);
  const [modalArquivar, setModalArquivar] = useState(false);

  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-200/80 dark:border-blue-900/50 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Link2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              Este número não está ligado a nenhum cliente
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Defina o destino deste contato para iniciar o atendimento correto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-border hover:bg-muted font-semibold"
            onClick={() => setModalArquivar(true)}
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            Não é cliente
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 font-semibold"
            onClick={() => setModalPreVenda(true)}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            Possível cliente
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
            onClick={() => setModalVincular(true)}
          >
            <Link2 className="h-3.5 w-3.5" />
            Vincular a cliente
          </Button>
        </div>
      </div>

      <VincularClienteModal
        open={modalVincular}
        onOpenChange={setModalVincular}
        conversaId={conversaId}
        telefone={telefone}
        nomeContatoPadrao={nomeCliente}
        onSuccess={onAtualizado}
      />

      <EnviarPreVendaModal
        open={modalPreVenda}
        onOpenChange={setModalPreVenda}
        conversaId={conversaId}
        nomeContatoPadrao={nomeCliente}
        onSuccess={onAtualizado}
      />

      <ArquivarConversaModal
        open={modalArquivar}
        onOpenChange={setModalArquivar}
        conversaId={conversaId}
        onSuccess={onAtualizado}
        onVincularClick={() => setModalVincular(true)}
      />
    </>
  );
}
