import { useState, useEffect } from 'react';
import { useStore, ScheduledMessage, formatTime } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, Clock, Send, AlertCircle, XCircle, CheckCircle, 
  Filter, MoreVertical, Trash2, Edit2, Play, RefreshCcw, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ScheduledMessagesPage() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const scheduledMessages = store.scheduledMessages;

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mensagens_agendadas')
        .select('*')
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
        senderName: m.sender_name,
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
        .update({ status: 'agendada', error_message: null })
        .eq('id', msg.id);
      
      if (error) throw error;
      store.updateScheduledMessage(msg.id, { status: 'agendada', errorMessage: undefined });
      toast.success("Tentativa de reenvio agendada");
    } catch (err) {
      toast.error("Erro ao re-agendar");
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'agendada': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'enviada': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'erro': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'cancelada': return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const MessageCard = ({ msg }: { msg: ScheduledMessage }) => (
    <Card className="mb-3 hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                {renderStatusIcon(msg.status)}
                {msg.status.toUpperCase()}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
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
    <div className="container mx-auto p-6 max-w-5xl animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mensagens Agendadas</h1>
          <p className="text-muted-foreground">Gerencie seus disparos automáticos e campanhas.</p>
        </div>
        <Button onClick={fetchScheduled} variant="outline" size="sm">
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="agendada" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="agendada">Agendadas</TabsTrigger>
          <TabsTrigger value="enviada">Enviadas</TabsTrigger>
          <TabsTrigger value="cancelada">Canceladas</TabsTrigger>
          <TabsTrigger value="erro">Erros</TabsTrigger>
        </TabsList>
        
        {['agendada', 'enviada', 'cancelada', 'erro'].map((status) => (
          <TabsContent key={status} value={status} className="mt-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : scheduledMessages.filter(m => m.status === status).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledMessages
                  .filter(m => m.status === status)
                  .map(msg => <MessageCard key={msg.id} msg={msg} />)
                }
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed rounded-xl">
                <Calendar className="w-12 h-12 opacity-10 mb-4" />
                <p className="text-sm">Nenhuma mensagem nesta categoria.</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
