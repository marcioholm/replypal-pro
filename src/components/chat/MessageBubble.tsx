import { Message, formatTime } from '@/lib/store';
import { AudioPlayer } from './AudioPlayer';
import { Clock, FileText, Download, ExternalLink, Image as ImageIcon, PlayCircle, MapPin, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface MessageBubbleProps {
  msg: Message;
  clientName: string;
}

export function MessageBubble({ msg, clientName }: MessageBubbleProps) {
  const isAgent = msg.sender === 'agent';

  const renderContent = () => {
    switch (msg.type) {
      case 'audio':
        return <AudioPlayer url={msg.mediaUrl || ''} sender={msg.sender} />;
      
      case 'image':
        return (
          <div className="space-y-2">
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer relative group rounded-lg overflow-hidden border border-border/20">
                  <img 
                    src={msg.mediaUrl} 
                    alt="Imagem" 
                    className="max-w-full h-auto object-contain max-h-[300px] transition-transform group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] max-h-[90vh] p-1 bg-black/90 border-none">
                <img src={msg.mediaUrl} alt="Preview" className="w-full h-full object-contain" />
              </DialogContent>
            </Dialog>
            {msg.content && <p className="text-sm">{msg.content}</p>}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden bg-black aspect-video max-w-full relative">
              <video 
                src={msg.mediaUrl} 
                controls 
                className="w-full h-full" 
                poster={msg.mediaUrl + '#t=0.5'}
              />
            </div>
            {msg.content && <p className="text-sm">{msg.content}</p>}
          </div>
        );

      case 'document':
        return (
          <div className={`p-3 rounded-lg border flex items-center gap-3 ${isAgent ? 'bg-white/10 border-white/20' : 'bg-muted/30 border-border/50'}`}>
            <div className={`p-2 rounded-md ${isAgent ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{msg.fileName || 'Documento'}</p>
              <p className="text-[10px] opacity-60">
                {msg.fileSize ? `${(msg.fileSize / 1024 / 1024).toFixed(2)} MB` : msg.mimeType}
              </p>
            </div>
            <div className="flex gap-1">
              <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-black/10 rounded transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a href={msg.mediaUrl} download={msg.fileName} className="p-1.5 hover:bg-black/10 rounded transition-colors">
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        );

      // IMPLEMENTAÇÃO 6: Sticker
      case 'sticker':
        return (
          <div className="w-28 h-28">
            <img src={msg.mediaUrl} alt="Sticker" className="w-full h-full object-contain" />
          </div>
        );

      // IMPLEMENTAÇÃO 6: Location
      case 'location':
        return (
          <a href={msg.mediaUrl || '#'} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-3 p-3 rounded-lg border hover:opacity-80 transition-opacity ${
              isAgent ? 'bg-white/10 border-white/20' : 'bg-muted/30 border-border/50'
            }`}>
            <div className={`p-2 rounded-md ${isAgent ? 'bg-white/20' : 'bg-green-500/10'}`}>
              <MapPin className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">{msg.fileName || 'Localização'}</p>
              <p className="text-[10px] opacity-60">Abrir no Google Maps →</p>
            </div>
          </a>
        );

      // IMPLEMENTAÇÃO 6: Contact
      case 'contact':
        return (
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            isAgent ? 'bg-white/10 border-white/20' : 'bg-muted/30 border-border/50'
          }`}>
            <div className={`p-2 rounded-full ${isAgent ? 'bg-white/20' : 'bg-primary/10'}`}>
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">{msg.fileName || 'Contato'}</p>
              <p className="text-[10px] opacity-60">Contato compartilhado</p>
            </div>
          </div>
        );

      default:
        return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
    }
  };

  const getStatusIcon = () => {
    if (!isAgent) return null;
    switch (msg.status) {
      case 'sending': return <Clock className="w-2.5 h-2.5 animate-pulse" />;
      case 'delivered': return <span className="text-[9px] font-bold">✓✓</span>;
      case 'read': return <span className="text-[9px] font-bold text-blue-300">✓✓</span>;
      default: return <span className="text-[9px]">✓</span>;
    }
  };

  return (
    <div className={`flex ${isAgent ? "justify-end" : "justify-start"} animate-fade-in group`}>
      {/* Adicionar mb-3 para dar espaço à reação */}
      <div className={`max-w-[75%] min-w-[120px] mb-3`}>
        <div className={`rounded-2xl px-4 py-3 shadow-sm relative ${
          isAgent 
            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md" 
            : "bg-card border border-border/50 rounded-bl-md"
        }`}>
          <p className={`text-[10px] font-semibold mb-1 flex justify-between items-center ${isAgent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            <span>{isAgent ? msg.senderName : clientName}</span>
          </p>
          
          <div className="py-0.5">
            {renderContent()}
          </div>
          
          <div className={`text-[9px] mt-2 flex items-center justify-end gap-1.5 ${isAgent ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
            <span>{formatTime(msg.timestamp)}</span>
            {getStatusIcon()}
          </div>
        </div>
        
        {/* Badge de reação */}
        {msg.reaction && (
          <div className={`flex ${isAgent ? "justify-end mr-2" : "justify-start ml-2"} -mt-2`}>
            <span className="bg-background border border-border/50 rounded-full px-1.5 py-0.5 text-sm shadow-sm">
              {msg.reaction}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}