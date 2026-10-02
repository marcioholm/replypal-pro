import { useState, useEffect } from 'react';
import { useStore, ScheduledMessage, formatTime } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, Clock, Send, AlertCircle, XCircle, CheckCircle, 
  Filter, MoreVertical, Trash2, Edit2, Play, RefreshCcw, Loader2, PlayCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PillToggle, Chip } from '@/components/conta-ui';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ScheduledMessagesPage() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agendada');
  const scheduledMessages = store.scheduledMessages;

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mensagens_agendadas')
        .select(`
          *,
          usuarios!created_by (
            nome
          )
        `)
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      
      store.addDbScheduledMessages(data.map(m => ({
        id: m.id,
        tenantId: m.tenant_id,
        clienteId: m.cliente_id,
        conversaId: m.conversa_id,
        receiverNumber: m.receiver_number,
        messageType: m.message_type,
        textContent: m.text_content,
        mediaUrl: m.media_url,
        mimeType: m.mime_type,
        fileName: m.file_name,
        scheduledAt: new Date(m.scheduled_at),
        status: m.status,
        createdBy: m.created_by,
        sentAt: m.sent_at ? new Date(m.sent_at) : undefined,
        errorMessage: m.error_message,
        senderName: m.sender_name || m.usuarios?.nome,
        createdAt: new Date(m.created_at),
        updatedAt: new Date(m.updated_at)
      })));
    } catch (err) {
      toast.error("Erro ao buscar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('mensagens_agendadas')
        .update({ status: 'cancelada' })
        .eq('id', id);
      
      if (error) throw error;
      store.updateScheduledMessage(id, { status: 'cancelada' });
      toast.success("Agendamento cancelado");
    } catch (err) {
      toast.error("Erro ao cancelar");
    }
  };

  const handleRetry = async (msg: ScheduledMessage) => {
    try {
      const { error } = await supabase
        .from('mensagens_agendadas')
        .update({ status: 'agendada', error_message: null, tentativas: 0, processando_em: null, scheduled_at: new Date().toISOString() })
        .eq('id', msg.id);
      
      if (error) throw error;
      store.updateScheduledMessage(msg.id, { status: 'agendada', errorMessage: undefined });
      toast.success("Tentativa de reenvio agendada");
    } catch (err) {
      toast.error("Erro ao re-agendar");
    }
  };

  const getStatusTone = (status: string): import('@/components/conta-ui').ChipTone => {
    switch (status) {
      case 'agendada': return 'blue';
      case 'enviada': return 'green';
      case 'erro': return 'red';
      case 'cancelada': return 'grey';
      default: return 'soft';
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'agendada': return <Clock className="w-4 h-4" />;
      case 'enviada': return <CheckCircle className="w-4 h-4" />;
      case 'erro': return <AlertCircle className="w-4 h-4" />;
      case 'cancelada': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const MessageCard = ({ msg }: { msg: ScheduledMessage }) => (
    <Card className="rounded-xl bg-card border-0 shadow-none hover:bg-muted/50 transition-colors group mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Chip tone={getStatusTone(msg.status)} className="uppercase">
                {renderStatusIcon(msg.status)}
                {msg.status}
              </Chip>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Para: {msg.receiverNumber} • Agendado por: {msg.senderName || 'Sistema'}
              </span>
            </div>
            
            <div className="flex gap-3">
              {msg.mediaUrl && (
                <div className="shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/40">
                  {msg.messageType === 'image' ? (
                    <img src={msg.mediaUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : msg.messageType === 'video' ? (
                    <PlayCircle className="w-6 h-6 text-primary" />
                  ) : (
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2 mb-2">
                  {msg.textContent || `[${msg.messageType.toUpperCase()}] ${msg.fileName || ''}`}
                </p>
                
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(msg.scheduledAt, "PP", { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(msg.scheduledAt, "p", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
            
            {msg.errorMessage && (
              <p className="text-[10px] text-red-500 mt-2 bg-red-50 p-1.5 rounded">
                Erro: {msg.errorMessage}
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {msg.status === 'agendada' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleCancel(msg.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            {msg.status === 'erro' && (
              <Button variant="outline" size="sm" onClick={() => handleRetry(msg)}>
                <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Re-enviar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-5 px-8 pb-8">
      <div className="flex justify-between items-center pt-5">
        <div className="flex flex-wrap gap-2">
          {['agendada', 'enviada', 'cancelada', 'erro'].map((status) => (
            <PillToggle 
              key={status} 
              active={activeTab === status} 
              onClick={() => setActiveTab(status)}
              count={scheduledMessages.filter(m => m.status === status).length}
            >
              {status === 'agendada' ? 'Agendadas' : 
               status === 'enviada' ? 'Enviadas' : 
               status === 'cancelada' ? 'Canceladas' : 'Erros'}
            </PillToggle>
          ))}
        </div>
        <Button onClick={fetchScheduled} variant="outline" size="sm">
          <RefreshCcw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : scheduledMessages.filter(m => m.status === activeTab).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduledMessages
              .filter(m => m.status === activeTab)
              .map(msg => <MessageCard key={msg.id} msg={msg} />)
            }
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-xl border-0">
            <Calendar className="w-12 h-12 opacity-10 mb-4" />
            <p className="text-[13px] font-semibold">Nenhuma mensagem nesta categoria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
