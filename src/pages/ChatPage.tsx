import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, formatTime, formatDuration, MOCK_TAGS, UserRole, MessageType, ConversationStatus, ClosingReason } from "@/lib/store";
import { sendWhatsAppMessage, checkConnection, sendMediaMessage, sendAudioMessage, sendTypingStatus, markAsRead, syncConversationHistory, checkWhatsApp, sendReaction, deleteMessage } from "@/lib/evolution";
import { webhooks } from "@/lib/webhooks";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { SLABadge } from "@/components/SLABadge";
import { TagBadge } from "@/components/TagBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Search from "lucide-react/dist/esm/icons/search";
import Paperclip from "lucide-react/dist/esm/icons/paperclip";
import Clock from "lucide-react/dist/esm/icons/clock";
import Zap from "lucide-react/dist/esm/icons/zap";
import Mic from "lucide-react/dist/esm/icons/mic";
import Send from "lucide-react/dist/esm/icons/send";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import User from "lucide-react/dist/esm/icons/user";
import StickyNote from "lucide-react/dist/esm/icons/sticky-note";
import Tag from "lucide-react/dist/esm/icons/tag";
import History from "lucide-react/dist/esm/icons/history";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import X from "lucide-react/dist/esm/icons/x";
import Users from "lucide-react/dist/esm/icons/users";
import StopCircle from "lucide-react/dist/esm/icons/stop-circle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Smile from "lucide-react/dist/esm/icons/smile";
import Reply from "lucide-react/dist/esm/icons/reply";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import PlayCircle from "lucide-react/dist/esm/icons/play-circle";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Play from "lucide-react/dist/esm/icons/play";
import Pause from "lucide-react/dist/esm/icons/pause";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { ScheduleMessageDialog } from "@/components/chat/ScheduleMessageDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CustomerForm } from "@/components/CustomerForm";
import { SimpleContactDialog } from "@/components/clientes/SimpleContactDialog";
import { Customer } from "@/lib/store";

// Lazy Components - Keep only non-critical ones if any

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const { user } = useAuth();
  
  const conv = store.getConversation(id || "");
  const messages = store.getMessages(id || "");
  const notes = store.getNotes(id || "");
  const history = store.getHistory(id || "");
  const customer = store.getCustomer(conv?.customerId);
  const quickReplies = store.quickReplies;

  const [messageInput, setMessageInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [showPanel, setShowPanel] = useState<"customer" | "notes" | "tags" | "history" | null>("customer");
  const [transferTo, setTransferTo] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingReason, setClosingReason] = useState<ClosingReason>("resolvido");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [linkCnpjOpen, setLinkCnpjOpen] = useState(false);
  const [cnpjInput, setCnpjInput] = useState("");
  const [contactNameInput, setContactNameInput] = useState("");
  const [contactSectorInput, setContactSectorInput] = useState("Outro");
  const [isLinking, setIsLinking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Novos estados de interação
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [forwardingMsg, setForwardingMsg] = useState<any>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [reactionMenuOpen, setReactionMenuOpen] = useState<{ id: string, externalId: string, x: number, y: number } | null>(null);
  const [instanceName, setInstanceName] = useState("replypal");

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.tenantId) return;
      const { data } = await supabase
        .from("company_settings")
        .select("instance_name")
        .eq("tenant_id", user.tenantId)
        .maybeSingle();
      
      if (data?.instance_name) {
        setInstanceName(data.instance_name);
      }
    };
    fetchSettings();
  }, [user?.tenantId]);


  const handleReactionSelect = async (emoji: string) => {
    if (!reactionMenuOpen || !conv?.clientPhone) return;
    
    const targetMsg = messages.find(m => m.id === reactionMenuOpen.id);
    
    try {
      const res = await sendReaction(
        conv.clientPhone, 
        reactionMenuOpen.externalId, 
        emoji,
        targetMsg?.message_key_json
      );
      if (res.success) {
        toast.success("Reação enviada!");
        setReactionMenuOpen(null);
      }
    } catch (err) {
      toast.error("Erro ao reagir");
    }
  };

  // Ouvidores de eventos do MessageBubble
  useEffect(() => {
    const handleReaction = (e: any) => {
      const { msgId, externalId } = e.detail;
      // Pegar posição do clique ou do evento se possível, senão centralizar
      setReactionMenuOpen({ id: msgId, externalId, x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 });
    };

    const handleReply = (e: any) => {
      setReplyingTo(e.detail.msg);
    };

    const handleDelete = async (e: any) => {
      const { msgId, externalId } = e.detail;
      const msg = storeRef.current.getMessages(id || "").find(m => m.id === msgId);

      if (confirm("Deseja realmente apagar esta mensagem para todos?")) {
        if (conv?.clientPhone) {
          try {
            const res = await deleteMessage(conv.clientPhone, externalId, msg?.message_key_json);
            if (res.success) {
              toast.success("Mensagem apagada!");
              await supabase.from("mensagens").delete().eq("id", msgId);
            }
          } catch (err) {
            console.error("Erro ao apagar:", err);
          }
        }
      }
    };

    const handleForward = (e: any) => {
      setForwardingMsg(e.detail.msg);
      setForwardModalOpen(true);
    };

    window.addEventListener('chat-reaction', handleReaction);
    window.addEventListener('chat-reply', handleReply);
    window.addEventListener('chat-delete', handleDelete);
    window.addEventListener('chat-forward', handleForward);

    return () => {
      window.removeEventListener('chat-reaction', handleReaction);
      window.removeEventListener('chat-reply', handleReply);
      window.removeEventListener('chat-delete', handleDelete);
      window.removeEventListener('chat-forward', handleForward);
    };
  }, [conv?.clientPhone]);
  
  // Media states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const { isRecording, recordingTime, audioBlob, startRecording, stopRecording, cancelRecording, clearAudio } = useAudioRecorder();
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      storeRef.current.setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId) return;

      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("tenant_id", tenantId)
          .limit(1000);

        if (error) throw error;
        if (data) {
          data.forEach(c => storeRef.current.addDbCustomer({
            id: c.id,
            name: c.nome_fantasia || c.razao_social || "Sem Nome",
            razaoSocial: c.razao_social || "",
            cnpj: c.cnpj || "",
            responsibleName: c.responsavel || "",
            whatsapp: c.whatsapp || "",
            phone: c.telefone || "",
            email: c.email || "",
            city: c.cidade || "",
            state: c.estado || "",
            regime: c.regime_tributario as any,
            status: c.status as any,
            priority: (c.prioridade || "Média") as any,
            tenantId: c.tenant_id,
            operational_status: c.operational_status as any,
            internal_responsible_name: c.internal_responsible_name,
            sector: c.sector as any,
            fantasy_name: c.nome_fantasia,
            whatsapp_status: c.whatsapp_status,
            createdAt: new Date(c.created_at)
          }));
        }
      } catch (err) {
        console.error("Erro ao pré-carregar contatos:", err);
      }
    };

    fetchCustomers();
  }, [user?.tenantId]);

  // Busca dinâmica de clientes para o encaminhamento
  useEffect(() => {
    if (!forwardSearch || forwardSearch.length < 2) return;

    const searchContacts = async () => {
      const tenantId = user?.tenantId;
      if (!tenantId) return;

      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(`nome_fantasia.ilike.%${forwardSearch}%,whatsapp.ilike.%${forwardSearch}%`)
          .limit(10);

        if (error) throw error;
        if (data) {
          data.forEach(c => storeRef.current.addDbCustomer({
            id: c.id,
            name: c.nome_fantasia || c.razao_social || "Sem Nome",
            razaoSocial: c.razao_social || "",
            cnpj: c.cnpj || "",
            responsibleName: c.responsavel || "",
            whatsapp: c.whatsapp || "",
            phone: c.telefone || "",
            email: c.email || "",
            city: c.cidade || "",
            state: c.estado || "",
            regime: c.regime_tributario as any,
            status: c.status as any,
            priority: (c.prioridade || "Média") as any,
            tenantId: c.tenant_id,
            operational_status: c.operational_status as any,
            internal_responsible_name: c.internal_responsible_name,
            sector: c.sector as any,
            fantasy_name: c.nome_fantasia,
            whatsapp_status: c.whatsapp_status,
            createdAt: new Date(c.created_at)
          }));
        }
      } catch (err) {
        console.error("Erro na busca de contatos:", err);
      }
    };

    const timer = setTimeout(searchContacts, 300);
    return () => clearTimeout(timer);
  }, [forwardSearch, user?.tenantId]);

  useEffect(() => {
    if (!id) return;

    const loadRealData = async () => {
      if (!conv) setLoading(true);
      
      try {
        if (!conv) {
          const { data: dbConv } = await supabase
            .from("conversas")
            .select("*")
            .eq("id", id)
            .maybeSingle();
            
          if (dbConv) {
            storeRef.current.addDbConversation({
              id: dbConv.id,
              clientName: dbConv.client_name,
              clientPhone: dbConv.client_phone,
              customerId: dbConv.customer_id,
              lastMessage: dbConv.last_message,
              lastMessageTime: new Date(dbConv.last_message_time),
              status: dbConv.status as ConversationStatus,
              assignedTo: dbConv.assigned_to,
              startedAt: dbConv.started_at ? new Date(dbConv.started_at) : undefined,
              slaDeadline: dbConv.sla_deadline ? new Date(dbConv.sla_deadline) : undefined,
              tags: dbConv.tags || [],
              clientAvatar: dbConv.client_avatar,
              tenantId: dbConv.tenant_id,
              isGroup: dbConv.is_group
            });
          }
        }

        const { data: dbMsgs } = await supabase
          .from("mensagens")
          .select("*")
          .eq("conversation_id", id)
          .order("timestamp", { ascending: true });
          
        if (dbMsgs) {
          storeRef.current.addDbMessages(dbMsgs.map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            content: m.content,
            sender: m.sender as "client" | "agent",
            senderName: m.sender_name,
            timestamp: new Date(m.timestamp),
            type: m.type as MessageType,
            mediaUrl: m.media_url,
            status: m.status,
            fileName: m.file_name,
            mimeType: m.mime_type,
            fileSize: m.file_size,
            durationSeconds: m.duration_seconds,
            external_message_id: m.external_message_id,
            wa_message_id: m.wa_message_id,
            remote_jid: m.remote_jid,
            from_me: m.from_me,
            participant: m.participant,
            message_key_json: m.message_key_json,
            instance_name: m.instance_name,
            reaction: m.reaction,
            quotedMessage: m.quoted_message
          })));
        }

        // Carregar histórico
        const { data: dbHistory } = await supabase
          .from("historico")
          .select("*")
          .eq("conversation_id", id)
          .order("timestamp", { ascending: false });

        if (dbHistory) {
          storeRef.current.addDbHistory(dbHistory.map(h => ({
            id: h.id,
            conversationId: h.conversation_id,
            customerId: h.customer_id,
            action: h.action,
            userId: h.user_id,
            userName: h.user_name,
            details: h.details,
            timestamp: new Date(h.timestamp)
          })));
        }

        // Se tiver poucas mensagens no banco, sincronizar histórico da Evolution
        const currentConv = conv || storeRef.current.getConversation(id || "");
        if (dbMsgs && dbMsgs.length < 15 && currentConv?.clientPhone) {
          const sync = await syncConversationHistory(currentConv.clientPhone, user?.tenantId || "");
          
          if (sync.success && sync.messages.length > 0) {
            for (const m of sync.messages) {
              const key = m.key || {};
              const msgContent = m.message || {};
              const text = msgContent.conversation 
                || msgContent.extendedTextMessage?.text 
                || msgContent.imageMessage?.caption
                || (msgContent.reactionMessage ? `Reagiu com ${msgContent.reactionMessage.text}` : "")
                || "";
              
              if (!text && !msgContent.audioMessage && !msgContent.imageMessage 
                  && !msgContent.videoMessage && !msgContent.documentMessage && !msgContent.reactionMessage) continue;
              
              const type = msgContent.audioMessage ? 'audio'
                : msgContent.imageMessage ? 'image'
                : msgContent.videoMessage ? 'video'
                : msgContent.documentMessage ? 'document'
                : msgContent.reactionMessage ? 'text'
                : 'text';
              
              // Upsert — não duplica se já existir
              await supabase.from("mensagens").upsert({
                conversation_id: id,
                content: text || `[${type}]`,
                sender: key.fromMe ? "agent" : "client",
                sender_name: key.fromMe ? "WhatsApp" : (m.pushName || currentConv.clientPhone),
                type,
                timestamp: new Date((m.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                external_message_id: key.id,
                wa_message_id: key.id,
                remote_jid: key.remoteJid,
                from_me: key.fromMe,
                participant: key.participant,
                message_key_json: key,
                instance_name: instanceName, // Precisamos garantir que temos o instanceName
                status: key.fromMe ? "sent" : "delivered",
                tenant_id: user?.tenantId
              }, { onConflict: "external_message_id" });
            }
            
            // Recarregar mensagens após sync
            const { data: refreshed } = await supabase
              .from("mensagens")
              .select("*")
              .eq("conversation_id", id)
              .order("timestamp", { ascending: true });
              
            if (refreshed) {
              storeRef.current.addDbMessages(refreshed.map(m => ({
                id: m.id,
                conversationId: m.conversation_id,
                content: m.content,
                sender: m.sender as "client" | "agent",
                senderName: m.sender_name,
                timestamp: new Date(m.timestamp),
                type: m.type as MessageType,
                mediaUrl: m.media_url,
                status: m.status,
                fileName: m.file_name,
                mimeType: m.mime_type,
                fileSize: m.file_size,
                durationSeconds: m.duration_seconds,
                external_message_id: m.external_message_id,
                wa_message_id: m.wa_message_id,
                remote_jid: m.remote_jid,
                from_me: m.from_me,
                participant: m.participant,
                message_key_json: m.message_key_json,
                instance_name: m.instance_name
              })));
            }
          }
        }


      } catch (e) {
        console.error("Error loading chat data:", e);
      } finally {
        setLoading(false);
      }
    };

    loadRealData();
    const pollInterval = setInterval(loadRealData, 3000);
    return () => clearInterval(pollInterval);
  }, [id, !!conv]);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!user?.tenantId) return;
      const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("tenant_id", user.tenantId);
      
      if (data) {
        storeRef.current.setUsers(data.map(d => ({
          id: d.id,
          name: d.nome,
          email: d.email,
          role: d.role as UserRole,
          tenantId: d.tenant_id,
          avatar: d.avatar,
          whatsapp: d.whatsapp
        })));
      }
    };
    fetchTeam();
  }, [user?.tenantId]);

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    
    // Rolar imediatamente
    scrollToBottom();
    
    // Rolar após um pequeno delay para garantir que imagens carregaram
    const timer = setTimeout(scrollToBottom, 500);
    return () => clearTimeout(timer);
  }, [messages.length, id, loading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Limpar preview anterior se existir
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
      
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    }
  };

  const uploadFile = async (file: File | Blob, name?: string) => {
    const fileExt = name ? name.split('.').pop() : 'ogg';
    const fileName = `${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${user?.tenantId || 'global'}/${fileName}`;

    const { error } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleCheckWhatsApp = async () => {
    if (!conv?.clientPhone) return;
    setIsVerifying(true);
    const { exists } = await checkWhatsApp(conv.clientPhone);
    if (exists) {
      toast.success("WhatsApp validado com sucesso!");
    } else {
      toast.error("Este número não parece ter um WhatsApp ativo.");
    }
    setIsVerifying(false);
  };

  const handleSend = async () => {
    if ((!messageInput.trim() && !selectedFile && !audioBlob) || !user || !conv) return;

    // IMPLEMENTAÇÃO 10: Parar typing indicator ao enviar
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTypingStatus(conv.clientPhone, false);

    const toastId = toast.loading("Enviando...");
    
    try {
      let mediaUrl = "";
      let type: MessageType = 'text';

      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile, selectedFile.name);
        if (selectedFile.type.startsWith('image/')) type = 'image';
        else if (selectedFile.type.startsWith('video/')) type = 'video';
        else type = 'document';

        const res = await sendMediaMessage(conv.clientPhone, mediaUrl, type as any, selectedFile.name, messageInput);
        if (!res.success) throw new Error(res.error);
        
        const extId = res.data?.key?.id;
        
        const msgId = store.sendMessage(id!, messageInput, user, { 
          type, 
          mediaUrl, 
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          status: 'sent',
          external_message_id: extId
        });

        await supabase.from("mensagens").insert({
          conversation_id: id,
          content: messageInput,
          sender: "agent",
          sender_name: user.name,
          type: type,
          media_url: mediaUrl,
          file_name: selectedFile.name,
          mime_type: selectedFile.type,
          file_size: selectedFile.size,
          external_message_id: extId,
          status: 'sent',
          tenant_id: user.tenantId
        });
      } else if (audioBlob) {
        mediaUrl = await uploadFile(audioBlob, 'audio.ogg');
        type = 'audio';
        
        const res = await sendAudioMessage(conv.clientPhone, mediaUrl);
        if (!res.success) throw new Error(res.error);
        
        const extId = res.data?.key?.id;

        store.sendMessage(id!, "[Áudio]", user, { 
          type, 
          mediaUrl, 
          mimeType: 'audio/ogg',
          durationSeconds: recordingTime,
          status: 'sent',
          external_message_id: extId
        });

        await supabase.from("mensagens").insert({
          conversation_id: id,
          content: "[Áudio]",
          sender: "agent",
          sender_name: user.name,
          type: 'audio',
          media_url: mediaUrl,
          mime_type: 'audio/ogg',
          duration_seconds: recordingTime,
          external_message_id: extId,
          status: 'sent',
          tenant_id: user.tenantId
        });
      } else {
        const res = await sendWhatsAppMessage(conv.clientPhone, messageInput, user.name, replyingTo?.external_message_id);
        if (!res.success) throw new Error(res.error);
        
        const extId = res.data?.key?.id;

        const msgData: any = {
          status: 'sent',
          external_message_id: extId
        };

        if (replyingTo) {
          msgData.quotedMessage = {
            id: replyingTo.id,
            content: replyingTo.content,
            sender: replyingTo.senderName
          };
        }

        store.sendMessage(id!, messageInput, user, msgData);

        await supabase.from("mensagens").insert({
          conversation_id: id,
          content: messageInput,
          sender: "agent",
          sender_name: user.name,
          type: 'text',
          external_message_id: extId,
          status: 'sent',
          tenant_id: user.tenantId,
          quoted_message: msgData.quotedMessage
        });
      }

      await supabase.from("conversas").update({
        last_message: messageInput || (selectedFile ? "[Mídia]" : "[Áudio]"),
        last_message_time: new Date().toISOString(),
        tenant_id: user.tenantId
      }).eq("id", id);

      setMessageInput("");
      setReplyingTo(null);
      setSelectedFile(null);
      setFilePreview(null);
      clearAudio();
      toast.success("Enviado", { id: toastId });
    } catch (err) {
      toast.error(`Falha ao enviar: ${String(err)}`, { id: toastId });
    }
  };

  // IMPLEMENTAÇÃO 10 + 3: handleSendAudio com typing indicator
  const handleSendAudio = useCallback(async (blob: Blob) => {
    if (!user || !conv) return;
    const toastId = toast.loading("Enviando áudio...");
    try {
      const mediaUrl = await uploadFile(blob, 'audio.ogg');
      const res = await sendAudioMessage(conv.clientPhone, mediaUrl);
      if (!res.success) throw new Error(res.error);
      const extId = res.data?.key?.id;
      store.sendMessage(id!, "[Áudio]", user, {
        type: 'audio', mediaUrl, mimeType: 'audio/ogg',
        durationSeconds: recordingTime, status: 'sent', external_message_id: extId
      });
      await supabase.from("mensagens").insert({
        conversation_id: id, content: "[Áudio]", sender: "agent",
        sender_name: user.name, type: 'audio', media_url: mediaUrl,
        mime_type: 'audio/ogg', duration_seconds: recordingTime,
        external_message_id: extId, status: 'sent', tenant_id: user.tenantId
      });
      await supabase.from("conversas").update({
        last_message: "[Áudio]", last_message_time: new Date().toISOString()
      }).eq("id", id);
      clearAudio();
      toast.success("Áudio enviado!", { id: toastId });
    } catch (err) {
      toast.error(`Falha ao enviar áudio: ${String(err)}`, { id: toastId });
    }
  }, [user, conv, id, recordingTime, store, clearAudio]);

  // IMPLEMENTAÇÃO 10: Marcar como lida ao abrir/receber mensagens
  useEffect(() => {
    if (!conv || !id) return;

    const markAsReadDb = async () => {
      try {
        // 1. Marcar como lida na Evolution API
        const lastClientMsg = [...messages].reverse()
          .find(m => m.sender === 'client' && m.external_message_id);
        // if (lastClientMsg?.external_message_id) {
        //   markAsRead(conv.clientPhone, lastClientMsg.external_message_id);
        // }

        // 2. Atualizar status no Supabase (de novo para pendente)
        if (conv.status === "novo") {
          await supabase
            .from("conversas")
            .update({ status: "pendente" })
            .eq("id", id);
          store.addDbConversation({ ...conv, status: "pendente" });
        }

        // 3. Marcar mensagens como lidas no banco
        await supabase
          .from("mensagens")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", id)
          .eq("sender", "client")
          .is("read_at", null);

      } catch (err) {
        console.error("Erro ao marcar como lida:", err);
      }
    };

    markAsReadDb();
  }, [id, conv?.id, conv?.status, messages.length]);


  const handleSchedule = async (scheduledAt: Date, customMessage?: string) => {
    const finalMessage = customMessage || messageInput;
    if (!finalMessage.trim() && !selectedFile) {
      toast.error("Adicione uma mensagem para agendar");
      return;
    }

    try {
      let mediaUrl = "";
      let type: MessageType = 'text';
      
      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile, selectedFile.name);
        if (selectedFile.type.startsWith('image/')) type = 'image';
        else if (selectedFile.type.startsWith('video/')) type = 'video';
        else type = 'document';
      }

      const { error } = await supabase
        .from('mensagens_agendadas')
        .insert({
          tenant_id: user?.tenantId,
          cliente_id: conv?.customerId || null, // Garantir que pode ser null
          conversa_id: conv?.id,
          receiver_number: conv?.clientPhone,
          message_type: type,
          text_content: finalMessage,
          media_url: mediaUrl,
          mime_type: selectedFile?.type,
          file_name: selectedFile?.name,
          scheduled_at: scheduledAt.toISOString(),
          status: 'agendada',
          created_by: user?.id
        });
      
      console.log("Agendamento enviado com sucesso - v2");

      if (error) throw error;
      
      toast.success(`Agendado para ${format(scheduledAt, "PPp", { locale: ptBR })}`);
      setMessageInput("");
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err: any) {
      console.error("Erro ao agendar:", err);
      toast.error(`Erro ao agendar: ${err.message || "Verifique os dados"}`);
    }
  };

  const handleAssume = async () => {
    try {
      const { error } = await supabase
        .from("conversas")
        .update({ assigned_to: user?.id, status: "em_atendimento" })
        .eq("id", id);
      if (error) throw error;
      
      // Registrar no histórico DB
      await supabase.from("historico").insert({
        conversation_id: id,
        action: "Conversa assumida",
        user_id: user.id,
        user_name: user.name
      });

      store.assumeConversation(id!, user!);
      toast.success("Você assumiu esta conversa!");
    } catch (e) {
      toast.error("Erro ao assumir conversa");
    }
  };

  const handleForwardMessage = async (targetPhone: string) => {
    if (!forwardingMsg || !user) return;
    const toastId = toast.loading("Encaminhando...");
    try {
      const originalSender = forwardingMsg.sender === 'client' ? conv?.clientName : forwardingMsg.senderName;
      const header = `*[Encaminhado por: ${user.name}]* (De: ${originalSender})\n\n`;
      const caption = header + (forwardingMsg.content || "");

      let res;
      if (forwardingMsg.type === 'text' || !forwardingMsg.type) {
        res = await sendWhatsAppMessage(targetPhone, caption, user.name);
      } else {
        // Encaminhar como mídia
        res = await sendMediaMessage(
          targetPhone, 
          forwardingMsg.mediaUrl, 
          forwardingMsg.type, 
          forwardingMsg.fileName || "arquivo", 
          caption,
          user.name
        );
      }

      if (!res.success) throw new Error(res.error);

      toast.success("Mensagem encaminhada!", { id: toastId });
      setForwardModalOpen(false);
      setForwardingMsg(null);
    } catch (err) {
      toast.error(`Erro ao encaminhar: ${String(err)}`, { id: toastId });
    }
  };

  const handleTransfer = async () => {
    if (!transferTo) return;
    try {
      const { error } = await supabase
        .from("conversas")
        .update({ assigned_to: transferTo })
        .eq("id", id);
      if (error) throw error;

      // Registrar no histórico DB
      const targetUser = store.users.find(u => u.id === transferTo);
      await supabase.from("historico").insert({
        conversation_id: id,
        action: `Transferida de ${user.name} para ${targetUser?.name || transferTo}`,
        user_id: user.id,
        user_name: user.name,
        details: transferReason || undefined
      });

      store.transferConversation(id!, user!, transferTo, transferReason);
      setTransferOpen(false);
      toast.success("Conversa transferida!");
    } catch (e) {
      toast.error("Erro ao transferir");
    }
  };

  const handleClose = async () => {
    try {
      const { error } = await supabase
        .from("conversas")
        .update({ status: "resolvido" })
        .eq("id", id);
      if (error) throw error;

      // Registrar no histórico DB
      await supabase.from("historico").insert({
        conversation_id: id,
        action: `Atendimento encerrado`,
        user_id: user.id,
        user_name: user.name,
        details: `Motivo: ${closingReason}`
      });

      store.updateStatus(id!, "resolvido", user!, closingReason);
      setCloseOpen(false);
      toast.success("Conversa encerrada");
    } catch (e) {
      toast.error("Erro ao encerrar");
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    store.addNote(id!, noteInput.trim(), user!);
    setNoteInput("");
    toast.success("Nota adicionada");
  };

  // IMPLEMENTAÇÃO 4: Tags com persistência no banco
  const handleAddTag = async (tagId: string) => {
    if (!conv || !id) return;
    const newTags = [...(conv.tags || []), tagId];
    try {
      await supabase.from("conversas").update({ tags: newTags }).eq("id", id);
      store.addTag(id, tagId);
    } catch {
      toast.error("Erro ao adicionar tag");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!conv || !id) return;
    const newTags = (conv.tags || []).filter(t => t !== tagId);
    try {
      await supabase.from("conversas").update({ tags: newTags }).eq("id", id);
      store.removeTag(id, tagId);
    } catch {
      toast.error("Erro ao remover tag");
    }
  };

  const handleAutoCreateCustomer = () => {
    setShowCreateModal(true);
  };

  const handleSyncHistory = async () => {
    if (!conv?.clientPhone || syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Sincronizando histórico completo...");
    try {
      const sync = await syncConversationHistory(conv.clientPhone, user?.tenantId || "");
      if (sync.success && sync.messages.length > 0) {
        for (const m of sync.messages) {
          const key = m.key || {};
          const msgContent = m.message || {};
          const text = msgContent.conversation 
            || msgContent.extendedTextMessage?.text 
            || msgContent.imageMessage?.caption
            || "";
          
          if (!text && !msgContent.audioMessage && !msgContent.imageMessage 
              && !msgContent.videoMessage && !msgContent.documentMessage) continue;
          
          const type = msgContent.audioMessage ? 'audio'
            : msgContent.imageMessage ? 'image'
            : msgContent.videoMessage ? 'video'
            : msgContent.documentMessage ? 'document'
            : 'text';
          
          await supabase.from("mensagens").upsert({
            conversation_id: id,
            content: text || `[${type}]`,
            sender: key.fromMe ? "agent" : "client",
            sender_name: key.fromMe ? "WhatsApp" : (m.pushName || conv.clientPhone),
            type,
            timestamp: new Date((m.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
            external_message_id: key.id,
            status: key.fromMe ? "sent" : "delivered",
            tenant_id: user?.tenantId
          }, { onConflict: "external_message_id" });
        }
        
        const { data: refreshed } = await supabase
          .from("mensagens")
          .select("*")
          .eq("conversation_id", id)
          .order("timestamp", { ascending: true });
          
        if (refreshed) {
          storeRef.current.addDbMessages(refreshed.map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            content: m.content,
            sender: m.sender as "client" | "agent",
            senderName: m.sender_name,
            timestamp: new Date(m.timestamp),
            type: m.type as MessageType,
            mediaUrl: m.media_url,
            status: m.status,
            fileName: m.file_name,
            mimeType: m.mime_type,
            fileSize: m.file_size,
            durationSeconds: m.duration_seconds,
            external_message_id: m.external_message_id
          })));
        }
        toast.success("Histórico sincronizado!", { id: toastId });
      } else {
        toast.info("Nenhuma nova mensagem encontrada no histórico.", { id: toastId });
      }
    } catch (err) {
      toast.error("Erro ao sincronizar histórico", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleCustomerCreated = async (newCustomer: Customer) => {

    if (!conv) return;
    
    try {
      // Vincular à conversa no DB
      const { error: convError } = await supabase
        .from("conversas")
        .update({ customer_id: newCustomer.id })
        .eq("id", id);
      
      if (convError) throw convError;

      // Registrar no histórico DB
      await supabase.from("historico").insert({
        conversation_id: id,
        customer_id: newCustomer.id,
        action: "Novo cliente cadastrado e vinculado",
        user_id: user?.id,
        user_name: user?.name,
        timestamp: new Date().toISOString()
      });

      store.addDbConversation({
        ...conv,
        customerId: newCustomer.id
      });

      setShowCreateModal(false);
      toast.success("Cliente vinculado com sucesso!");
    } catch (err) {
      console.error("Erro ao vincular cliente:", err);
      toast.error("Erro ao vincular cliente");
    }
  };

  const handleLinkCnpj = async (cnpj: string) => {
    if (!cnpj || !conv) return;
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length < 11) {
      toast.error("CNPJ/CPF inválido");
      return;
    }

    setIsLinking(true);
    try {
      // 1. Buscar cliente por CNPJ
      const { data: customerData, error: customerError } = await supabase
        .from("clientes")
        .select("*")
        .eq("cnpj", cleanCnpj)
        .maybeSingle();
      
      if (customerError) throw customerError;
      
      if (!customerData) {
        toast.error("CNPJ não encontrado na base de clientes.");
        setIsLinking(false);
        return;
      }

      // 2. Vincular à conversa e atualizar nome se fornecido
      const updatePayload: any = { customer_id: customerData.id };
      if (contactNameInput) {
        updatePayload.client_name = contactNameInput;
      }

      const { error: convError } = await supabase
        .from("conversas")
        .update(updatePayload)
        .eq("id", id);
      
      if (convError) throw convError;

      // 3. Adicionar ao array de contatos do cliente (Setor/Nome)
      const existingContacts = Array.isArray(customerData.contacts) ? customerData.contacts : [];
      const contactExists = existingContacts.find((c: any) => c.phone === conv.clientPhone);
      
      let newContacts = [...existingContacts];
      const newContact = {
        name: contactNameInput || conv.clientName,
        phone: conv.clientPhone,
        type: contactSectorInput,
        addedAt: new Date().toISOString()
      };

      if (contactExists) {
        // Atualizar nome/setor se já existe
        newContacts = existingContacts.map(c => c.phone === conv.clientPhone ? { ...c, ...newContact } : c);
      } else {
        newContacts.push(newContact);
      }

      await supabase
        .from("clientes")
        .update({ contacts: newContacts })
        .eq("id", customerData.id);

      // 3.5. Se era um contato avulso (cliente sem CNPJ), remover para "separar"
      if (conv.customerId) {
        const { data: currentCust } = await supabase.from("clientes").select("cnpj").eq("id", conv.customerId).maybeSingle();
        if (currentCust && (!currentCust.cnpj || currentCust.cnpj.trim() === "")) {
          await supabase.from("clientes").delete().eq("id", conv.customerId);
        }
      }

      // 4. Registrar nos logs (Conversa e Cliente)
      const logDetails = `CNPJ: ${cleanCnpj} - ${customerData.nome_fantasia || customerData.razao_social}${contactNameInput ? ` (Setor: ${contactNameInput})` : ""}`;
      
      await supabase.from("historico").insert([
        {
          conversation_id: id,
          customer_id: customerData.id,
          action: "Cliente vinculado via CNPJ",
          user_id: user?.id,
          user_name: user?.name,
          details: logDetails,
          timestamp: new Date().toISOString()
        }
      ]);

      // Atualizar store local
      store.addDbConversation({
        ...conv,
        customerId: customerData.id,
        clientName: contactNameInput || conv.clientName
      });
      
      // Mapear para o formato do store
      store.addDbCustomer({
        id: customerData.id,
        name: customerData.nome_fantasia,
        razaoSocial: customerData.razao_social,
        cnpj: customerData.cnpj,
        responsibleName: customerData.responsavel,
        whatsapp: customerData.whatsapp,
        phone: customerData.telefone,
        email: customerData.email,
        city: customerData.cidade,
        state: customerData.estado,
        regime: customerData.regime_tributario,
        naturezaJuridica: customerData.natureza_juridica,
        cnae: customerData.cnae,
        hasEmployees: customerData.has_employees,
        employeeCount: customerData.employee_count,
        status: customerData.status,
        priority: customerData.prioridade,
        serviceLevel: customerData.service_level,
        preferredChannel: customerData.preferred_channel,
        plan: customerData.plan,
        monthlyValue: customerData.monthly_value,
        tenantId: customerData.tenant_id,
        createdAt: new Date(customerData.created_at)
      } as any);

      toast.success("Cliente vinculado com sucesso!");
      setLinkCnpjOpen(false);
      setCnpjInput("");
    } catch (err: any) {
      console.error("Erro ao vincular CNPJ:", err);
      toast.error(`Erro ao vincular: ${err.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center h-full bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!conv) return <div className="flex flex-col items-center justify-center h-full bg-background gap-4"><p>Conversa não encontrada</p><Button onClick={() => navigate("/")}>Voltar</Button></div>;

  const isAdmin = user.role === "admin";
  const isAssigned = conv.assignedTo === user.id;
  const canRespond = isAssigned || isAdmin;
  const slaStatus = store.getSLAStatus(conv);

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-background overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r">
        {/* Header */}
        <div className="p-4 border-b bg-card flex items-center gap-4 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-9 w-9 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shadow-sm border border-primary/20 overflow-hidden">
            {conv.clientAvatar ? (
              <img 
                src={conv.clientAvatar} 
                alt={conv.clientName} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : conv.isGroup ? (
              <Users className="w-5 h-5" />
            ) : (
              conv.clientName.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{conv.clientName}</p>
            <div className="flex items-center gap-2">
              {conv.isTyping ? (
                <span className="text-xs text-primary font-medium animate-pulse flex items-center gap-1">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                  digitando...
                </span>
              ) : (
                <>
                  <StatusBadge status={conv.status} />
                  <SLABadge slaStatus={slaStatus} />
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSyncHistory} 
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
            {!isAssigned && conv.status !== "resolvido" && (
              <Button size="sm" onClick={handleAssume}>Assumir</Button>
            )}
            {!customer && (
              <SimpleContactDialog 
                initialPhone={conv.clientPhone} 
                initialName={conv.clientName === conv.clientPhone ? "" : conv.clientName}
                onSuccess={handleCustomerCreated}
                trigger={
                  <Button size="sm" variant="success" className="gap-2 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20">
                    <UserPlus className="h-4 w-4" />
                    Salvar Contato
                  </Button>
                }
              />
            )}
            {isAssigned && conv.status !== "resolvido" && (
              <>
                <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Transferir</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Transferir Conversa</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <Select value={transferTo} onValueChange={setTransferTo}>
                        <SelectTrigger><SelectValue placeholder="Selecione o atendente" /></SelectTrigger>
                        <SelectContent>
                          {store.users.filter(u => u.id !== user.id).map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Motivo (opcional)" value={transferReason} onChange={e => setTransferReason(e.target.value)} />
                      <Button onClick={handleTransfer} className="w-full">Confirmar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">Encerrar</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Encerrar Atendimento</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <Select value={closingReason} onValueChange={v => setClosingReason(v as ClosingReason)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resolvido">Resolvido</SelectItem>
                          <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
                          <SelectItem value="transferido">Transferido</SelectItem>
                          <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleClose} className="w-full">Finalizar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} clientName={conv.clientName} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-card">
          {conv.status === "resolvido" ? (
            <div className="text-center py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-muted/30">
              Atendimento Encerrado
            </div>
          ) : !canRespond ? (
            <div className="text-center py-3 text-xs font-bold uppercase tracking-widest text-primary/60 bg-primary/5 rounded-xl border border-dashed border-primary/20">
              Aguardando Assumir Atendimento
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-2 p-3 bg-muted/80 backdrop-blur-sm rounded-xl border-l-4 border-primary flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">{replyingTo.senderName}</p>
                    <p className="text-xs truncate text-muted-foreground">{replyingTo.content}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setReplyingTo(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Media/Audio Preview */}
              {(selectedFile || audioBlob) && (
                <div className="flex items-center gap-3 p-2 bg-primary/5 border rounded-lg animate-in slide-in-from-bottom-2">
                  {selectedFile?.type.startsWith('image/') ? (
                    <img src={filePreview || ''} className="w-14 h-14 rounded-xl object-cover border border-primary/20 shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                      {selectedFile?.type.startsWith('video/') ? (
                        <PlayCircle className="w-7 h-7 text-primary" />
                      ) : audioBlob ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary hover:bg-primary/20"
                          onClick={() => {
                            if (!audioPreviewRef.current) {
                              const url = URL.createObjectURL(audioBlob);
                              const audio = new Audio(url);
                              audio.onended = () => setIsPreviewPlaying(false);
                              audioPreviewRef.current = audio;
                            }
                            
                            if (isPreviewPlaying) {
                              audioPreviewRef.current.pause();
                              setIsPreviewPlaying(false);
                            } else {
                              audioPreviewRef.current.play();
                              setIsPreviewPlaying(true);
                            }
                          }}
                        >
                          {isPreviewPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </Button>
                      ) : (
                        <FileText className="w-7 h-7 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{selectedFile?.name || (audioBlob ? 'Áudio Gravado' : 'Mídia')}</p>
                    {audioBlob && <p className="text-[10px] text-muted-foreground">{recordingTime}s - {isPreviewPlaying ? 'Reproduzindo...' : 'Clique para ouvir'}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { 
                    setSelectedFile(null); 
                    setFilePreview(null); 
                    clearAudio(); 
                    if (audioPreviewRef.current) {
                      audioPreviewRef.current.pause();
                      audioPreviewRef.current = null;
                      setIsPreviewPlaying(false);
                    }
                  }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                <div className="flex gap-1 mb-1">
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-primary">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <ScheduleMessageDialog 
                    initialMessage={messageInput}
                    onSchedule={handleSchedule} 
                    trigger={
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                        <Clock className="w-5 h-5" />
                      </Button>
                    } 
                  />
                  <Popover open={showQuickReplies} onOpenChange={setShowQuickReplies}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                        <Zap className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-[300px] p-0">
                      <div className="p-2 border-b"><p className="text-xs font-semibold text-muted-foreground">Respostas Rápidas</p></div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {quickReplies.map((qr) => (
                          <button key={qr.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md" onClick={() => { setMessageInput(qr.content); setShowQuickReplies(false); }}>
                            <div className="font-medium text-xs text-primary">{qr.shortcut}</div>
                            <div className="truncate text-muted-foreground text-xs">{qr.content}</div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1 relative">
                  {isRecording ? (
                    <div className="h-10 flex items-center px-4 bg-primary/5 rounded-full border border-primary/20 animate-pulse w-full">
                      <div className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-ping" />
                      <span className="text-sm font-medium flex-1">Gravando... {recordingTime}s</span>
                      <Button variant="ghost" size="sm" className="h-7 text-red-500 mr-2 hover:bg-red-50" onClick={cancelRecording}>Descartar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-primary hover:bg-primary/10" onClick={() => stopRecording()}><StopCircle className="w-4 h-4 mr-1 text-red-500" /> Parar</Button>
                    </div>
                  ) : (
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        if (conv?.clientPhone) {
                          sendTypingStatus(conv.clientPhone, true);
                          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                          typingTimerRef.current = setTimeout(() => {
                            sendTypingStatus(conv.clientPhone, false);
                          }, 3000);
                        }
                      }}
                      className="min-h-[40px] h-10 py-2.5 resize-none bg-muted/50 border-none rounded-2xl focus-visible:ring-1"
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                    />
                  )}
                </div>

                {(!messageInput.trim() && !selectedFile && !isRecording) ? (
                  <Button size="icon" className="h-10 w-10 rounded-full" onClick={startRecording}><Mic className="w-5 h-5" /></Button>
                ) : (
                  <Button size="icon" className="h-10 w-10 rounded-full" onClick={handleSend} disabled={isRecording}><Send className="w-5 h-5" /></Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Panel */}
      <div className="w-80 flex flex-col bg-card shrink-0">
        <div className="flex border-b">
          {[
            { key: "customer" as const, icon: User, label: "Cliente" },
            { key: "notes" as const, icon: StickyNote, label: "Notas" },
            { key: "tags" as const, icon: Tag, label: "Tags" },
            { key: "history" as const, icon: History, label: "Log" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setShowPanel(tab.key)}
              className={`flex-1 py-3 text-[10px] uppercase font-bold flex flex-col items-center gap-1 border-b-2 transition-all ${showPanel === tab.key ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:bg-muted/50"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {showPanel === "customer" && (
            <div className="space-y-4">
              {customer ? (
                <>
                  <div className="p-4 bg-muted/30 rounded-xl border space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Regime Tributário</p>
                      <Badge variant="outline" className="text-xs">{customer.regime}</Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Prioridade</p>
                      <Badge className={customer.priority === 'Alta' ? 'bg-destructive' : 'bg-primary'}>{customer.priority}</Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Responsável</p>
                      <p className="text-sm font-medium">{store.users.find(u => u.id === customer.attendantId)?.name || 'Nenhum'}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/customers/${customer.id}`)}>Ver Cadastro Completo</Button>
                </>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">Cliente não cadastrado.</p>
                  
                    <SimpleContactDialog 
                      initialPhone={conv.clientPhone} 
                      initialName={conv.clientName === conv.clientPhone ? "" : conv.clientName}
                      onSuccess={handleCustomerCreated}
                      trigger={
                        <Button className="w-full gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                          <UserPlus className="h-4 w-4" />
                          Adicionar Contato (Rápido)
                        </Button>
                      }
                    />

                  <Button variant="ghost" onClick={handleAutoCreateCustomer} className="w-full text-xs">
                    Cadastro Completo (Empresa)
                  </Button>
                  
                  <Dialog open={linkCnpjOpen} onOpenChange={setLinkCnpjOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">Vincular a CNPJ</Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[32px]">
                      <DialogHeader>
                        <DialogTitle>Vincular a CNPJ Existente</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between ml-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase">CNPJ do Cliente</p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleCheckWhatsApp}
                              disabled={isVerifying}
                              className="h-6 px-2 text-[9px] font-bold uppercase tracking-widest text-green-500 hover:bg-green-500/5 gap-1"
                            >
                              {isVerifying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle className="w-2.5 h-2.5" />}
                              Validar WhatsApp
                            </Button>
                          </div>
                          <Input 
                            placeholder="00.000.000/0000-00" 
                            value={cnpjInput} 
                            onChange={(e) => setCnpjInput(e.target.value)}
                            className="rounded-2xl h-12 font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase ml-1">Nome do Contato</p>
                            <Input 
                              placeholder="Nome do contato" 
                              value={contactNameInput} 
                              onChange={(e) => setContactNameInput(e.target.value)}
                              className="rounded-2xl h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase ml-1">Departamento / Setor</p>
                            <Select value={contactSectorInput} onValueChange={setContactSectorInput}>
                              <SelectTrigger className="rounded-2xl h-12">
                                <SelectValue placeholder="Selecione o setor" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Financeiro", "RH", "Fiscal", "Societário", "Outro"].map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleLinkCnpj(cnpjInput)} 
                          className="w-full rounded-2xl h-12 font-bold shadow-lg shadow-primary/20"
                          disabled={isLinking}
                        >
                          {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vincular e Salvar Contato"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          )}

          {showPanel === "notes" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Textarea placeholder="Nova nota interna..." value={noteInput} onChange={e => setNoteInput(e.target.value)} className="text-sm min-h-[80px]" />
                <Button size="sm" className="w-full" onClick={handleAddNote}>Salvar Nota</Button>
              </div>
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="p-3 bg-muted/50 rounded-lg border text-xs">
                    <p className="font-bold mb-1">{n.authorName}</p>
                    <p className="text-muted-foreground">{n.content}</p>
                    <p className="text-[9px] mt-2 opacity-50">{formatTime(n.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPanel === "tags" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {conv.tags.map(t => (
                  <TagBadge key={t} tagId={t} onRemove={() => handleRemoveTag(t)} />
                ))}
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-bold text-muted-foreground mb-3">Disponíveis</p>
                <div className="flex flex-wrap gap-2">
                  {MOCK_TAGS.filter(t => !conv.tags.includes(t.id)).map(tag => (
                    <button key={tag.id} onClick={() => handleAddTag(tag.id)} className="text-[10px] px-3 py-1 rounded-full border border-dashed hover:border-solid transition-all" style={{ borderColor: tag.color, color: tag.color }}>
                      + {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showPanel === "history" && (
            <div className="space-y-3">
              {history.length > 0 ? (
                history.map(h => (
                  <div key={h.id} className="p-3 bg-muted/20 border-l-2 border-primary/30 rounded-r-lg text-[11px] animate-in fade-in slide-in-from-right-1">
                    <p className="font-bold text-foreground">{h.action}</p>
                    {h.userName && <p className="text-muted-foreground mt-0.5">por {h.userName}</p>}
                    {h.details && <p className="text-[10px] mt-1 italic text-muted-foreground/80">{h.details}</p>}
                    <p className="text-[9px] mt-1.5 opacity-50 font-mono">{formatTime(h.timestamp)}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <RefreshCw className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">Nenhum log registrado</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Ações como transferências e encerramentos aparecerão aqui.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <CustomerForm 
            initialData={{
              id: "",
              name: conv?.clientName || "",
              razaoSocial: conv?.clientName || "",
              responsibleName: conv?.clientName || "",
              whatsapp: conv?.clientPhone || "",
              phone: conv?.clientPhone || "",
              tenantId: user?.tenantId || "",
              status: "Onboarding",
              priority: "Média",
              serviceLevel: "Padrão",
              preferredChannel: "WhatsApp",
              plan: "Pendente",
              monthlyValue: 0,
              origin: "WhatsApp",
              createdAt: new Date(),
              tags: [],
              contacts: [],
              documents: [],
              observations: "Criado via chat",
              cnpj: "",
              email: "",
              city: "",
              state: "",
              regime: "Simples Nacional",
              naturezaJuridica: "",
              cnae: "",
              hasEmployees: false,
              employeeCount: 0
            }}
            onSuccess={handleCustomerCreated}
          />
        </DialogContent>
      </Dialog>
      {/* Forward Dialog */}
      <Dialog open={forwardModalOpen} onOpenChange={setForwardModalOpen}>
        <DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Encaminhar Mensagem</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar contato..." 
                className="pl-9 rounded-2xl bg-muted/50 border-none h-12 focus-visible:ring-primary/20" 
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
              />
            </div>
            
            <div className="max-h-[350px] overflow-y-auto space-y-1 -mx-2 px-2 custom-scrollbar">
              {(() => {
                // Se a busca estiver vazia, mostrar conversas recentes
                if (!forwardSearch) {
                  return store.conversations.map(c => (
                    <button 
                      key={c.id} 
                      disabled={loading}
                      onClick={() => handleForwardMessage(c.clientPhone)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 rounded-2xl transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 border border-primary/20 group-hover:scale-105 transition-transform">
                        {c.clientAvatar ? <img src={c.clientAvatar} className="w-full h-full rounded-full object-cover" /> : c.clientName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{c.clientName}</p>
                        <p className="text-[11px] text-muted-foreground">{c.clientPhone}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <ArrowRight className="w-4 h-4 text-primary" />
                      </div>
                    </button>
                  ));
                }

                // Filtrar localmente os clientes carregados
                const filtered = store.customers.filter(d => 
                  d.name.toLowerCase().includes(forwardSearch.toLowerCase()) || 
                  d.phone.includes(forwardSearch)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center space-y-2 opacity-50">
                      <Search className="w-8 h-8 mx-auto" />
                      <p className="text-sm">Nenhum contato encontrado</p>
                    </div>
                  );
                }

                return filtered.map(c => (
                  <button 
                    key={c.id} 
                    disabled={loading}
                    onClick={() => handleForwardMessage(c.phone)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 rounded-2xl transition-all text-left group relative overflow-hidden"
                  >
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 border border-primary/20 group-hover:scale-105 transition-transform">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reaction Menu Overlay */}
      {reactionMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setReactionMenuOpen(null)}>
          <div 
            className="bg-background/95 backdrop-blur-xl p-3 rounded-[24px] shadow-2xl border border-primary/20 flex gap-2 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥"].map(emoji => (
              <button 
                key={emoji}
                onClick={() => handleReactionSelect(emoji)}
                className="text-2xl hover:scale-125 hover:bg-primary/10 p-2 rounded-xl transition-all active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
