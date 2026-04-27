import { type LucideIcon, Inbox, FileText, Users, MessageSquare, Search, Calendar, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/30" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

export function InboxEmptyState({ onClearFilters }: { onClearFilters?: () => void }) {
  return (
    <EmptyState
      icon={Inbox}
      title="Nenhuma conversa encontrada"
      description="Experimente mudar o filtro ou buscar outro termo."
      action={
        onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        )
      }
    />
  );
}

export function DocumentsEmptyState() {
  return (
    <EmptyState
      icon={FileText}
      title="Nenhum documento enviado"
      description="Clique em 'Enviar' para adicionar documentos a este cliente."
    />
  );
}

export function CustomersEmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="Nenhum cliente cadastrado"
      description="Comece adicionando seu primeiro cliente ao sistema."
      action={
        onAdd && (
          <Button onClick={onAdd}>
            Adicionar Cliente
          </Button>
        )
      }
    />
  );
}

export function ConversationsEmptyState() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="Nenhum atendimento registrado"
      description="Aguarde novas mensagens ou inicie um atendimento manualmente."
    />
  );
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title={`Nenhum resultado para "${query}"`}
      description="Tente buscar com outros termos ou verificar a ortografia."
    />
  );
}

export function CalendarEmptyState() {
  return (
    <EmptyState
      icon={Calendar}
      title="Nenhuma obrigação cadastrada"
      description="Adicione obrigações fiscais e prazos ao calendário."
    />
  );
}

export function SettingsEmptyState() {
  return (
    <EmptyState
      icon={Settings}
      title="Configuração pendente"
      description="Complete a configuração desta área para continuar."
    />
  );
}