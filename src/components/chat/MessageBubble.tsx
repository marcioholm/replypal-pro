import { Message, formatTime } from '@/lib/store';
import { AudioPlayer } from './AudioPlayer';
import { Clock, FileText, Download, ExternalLink, Image as ImageIcon, PlayCircle, MapPin, User as UserIcon, Smile, Reply, Share2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface MessageBubbleProps {
  msg: Message;
  clientName: string;
}

export function MessageBubble({ msg, clientName }: MessageBubbleProps) {
  const isAgent = msg.sender === 'agent';

  const renderContent = () => {
    const type = msg.type?.toUpperCase() || 'TEXT';
    switch (type) {
      case 'AUDIO':
        return <AudioPlayer url={msg.mediaUrl || ''} sender={msg.sender} />;
      
      case 'IMAGE':
        return (
          <div className="space-y-2">
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer relative group rounded-lg overflow-hidden border border-border/20">
                  <img 
                    src={msg.mediaUrl} 
                    alt="Imagem" 
                    className="max-w-full h-auto object-contain max-h-[300px] transition-transform group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.img-error-info')) {
                        const info = document.createElement('div');
                        info.className = 'img-error-info p-3 flex flex-col gap-1 bg-muted/20 border-t';
                        info.innerHTML = `
                          <span class="text-[10px] font-bold text-destructive">Erro ao carregar mídia</span>
                          <code class="text-[9px] break-all p-1 bg-background/50 rounded select-all">${msg.mediaUrl}</code>
                          <a href="${msg.mediaUrl}" target="_blank" class="text-[10px] text-primary underline mt-1">Abrir em nova guia</a>
                        `;
                        parent.appendChild(info);
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none flex items-center justify-center overflow-hidden">
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img 
                    src={msg.mediaUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-[85vh] h-auto w-auto object-contain shadow-2xl rounded-sm" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              </DialogContent>
            </Dialog>
            {msg.content && <p className="text-sm">{msg.content}</p>}
          </div>
        );

      case 'VIDEO':
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

      case 'DOCUMENT':
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

      case 'STICKER':
        return (
          <div className="w-28 h-28 relative group">
            <img 
              src={msg.mediaUrl} 
              alt="Sticker" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.img-error-btn')) {
                  const btn = document.createElement('div');
                  btn.className = 'img-error-btn p-2 flex flex-col items-center gap-1 bg-muted/10 rounded border border-dashed';
                  btn.innerHTML = `<span class="text-[10px] opacity-60">Erro</span><a href="${msg.mediaUrl}" target="_blank" class="text-[9px] text-primary underline">Link</a>`;
                  parent.appendChild(btn);
                }
              }}
            />
          </div>
        );

      // IMPLEMENTAÇÃO 6: Location
      case 'LOCATION':
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
      case 'CONTACT':
        return (
          <div className={`space-y-2 p-3 rounded-lg border ${
            isAgent ? 'bg-white/10 border-white/20' : 'bg-muted/30 border-border/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isAgent ? 'bg-white/20' : 'bg-primary/10'}`}>
                <UserIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{msg.fileName || 'Contato'}</p>
                <p className="text-[10px] opacity-60">Contato compartilhado</p>
              </div>
            </div>
            
            {msg.mediaUrl && (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-new-chat', { detail: { phone: msg.mediaUrl } }))}
                className={`w-full mt-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isAgent 
                    ? "bg-white/20 hover:bg-white/30 text-white" 
                    : "bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20"
                }`}
              >
                Conversar
              </button>
            )}
          </div>
        );

      default:
        const renderTextWithLinks = (text: string) => {
          if (!text) return null;
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const parts = text.split(urlRegex);
          
          return parts.map((part, i) => {
            if (part.match(urlRegex)) {
              return (
                <a 
                  key={i} 
                  href={part} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary-foreground underline underline-offset-2 hover:opacity-80 break-all"
                >
                  {part}
                </a>
              );
            }
            return part;
          });
        };
        
        return (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {renderTextWithLinks(msg.content)}
          </p>
        );
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
    <div className={`flex ${isAgent ? "justify-end" : "justify-start"} animate-fade-in group relative mb-4`}>
      {/* Menu de Ações (Flutuante em cima do balão) */}
      <div className={`absolute -top-8 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 flex items-center gap-1 p-1 bg-background/90 backdrop-blur-md rounded-full shadow-xl border border-primary/20 ${
        isAgent ? "right-0" : "left-0"
      }`}>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('chat-reaction', { detail: { msgId: msg.id, externalId: msg.external_message_id } }))}
          className="p-1.5 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
          title="Reagir"
        >
          <Smile className="w-4 h-4" />
        </button>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('chat-reply', { detail: { msg } }))}
          className="p-1.5 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
          title="Responder"
        >
          <Reply className="w-4 h-4" />
        </button>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('chat-forward', { detail: { msg } }))}
          className="p-1.5 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
          title="Encaminhar"
        >
          <Share2 className="w-4 h-4" />
        </button>
        {isAgent && (
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('chat-delete', { detail: { msgId: msg.id, externalId: msg.external_message_id } }))}
            className="p-1.5 hover:bg-destructive/10 rounded-full transition-colors text-muted-foreground hover:text-destructive"
            title="Apagar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={`max-w-[75%] min-w-[120px] mb-3 relative`}>
        {/* Badge de reação - Posicionado no topo */}
        {msg.reaction && (
          <div className={`absolute -top-2 z-10 flex ${isAgent ? "right-2" : "left-2"}`}>
            <span className="bg-background border border-border/50 rounded-full px-1.5 py-0.5 text-sm shadow-md animate-in zoom-in-50 duration-300">
              {msg.reaction}
            </span>
          </div>
        )}

        <div className={`rounded-2xl px-4 py-3 shadow-sm relative ${
          isAgent 
            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md" 
            : "bg-card border border-border/50 rounded-bl-md"
        }`}>
          {/* Citação (Reply) */}
          {msg.quotedMessage && (
            <div className={`mb-2 p-2 rounded-lg border-l-4 text-[11px] overflow-hidden ${
              isAgent ? "bg-black/10 border-white/30 text-white/90" : "bg-muted border-primary text-muted-foreground"
            }`}>
              <p className="font-bold mb-0.5">{msg.quotedMessage.sender}</p>
              <p className="truncate opacity-80">{msg.quotedMessage.content}</p>
            </div>
          )}

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
      </div>
    </div>
  );
}// Force rebuild
