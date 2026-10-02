import { useState, useRef, useEffect, useCallback } from "react";
import { linkDoDocumento } from "@/lib/documentos";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, formatTime, formatDuration, formatDateTime, UserRole, MessageType, ConversationStatus, ClosingReason, MOCK_TAGS } from "@/lib/store";
import { sendWhatsAppMessage, checkConnection, sendMediaMessage, sendAudioMessage, sendTypingStatus, markAsRead, syncConversationHistory, checkWhatsApp, sendReaction, deleteMessage, fetchGroupInfo } from "@/lib/evolution";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Paperclip, Clock, Zap, Mic, Send, RefreshCw, Loader2, User, StickyNote, Tag, History, Activity, MessageSquare, UserPlus, X, Users, StopCircle, CheckCircle, Share2, Smile, Reply, Trash2, ArrowRight, PlayCircle, FileText, Play, Pause, FolderOpen, AlertCircle, Sparkles, Link2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { insertHistorico } from "@/lib/historico";
import { useAuth } from "@/lib/auth";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { InitialsAvatar, Chip } from "@/components/conta-ui";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { ScheduleMessageDialog } from "@/components/chat/ScheduleMessageDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CustomerForm } from "@/components/CustomerForm";
import { SimpleContactDialog } from "@/components/clientes/SimpleContactDialog";
import { AbaArquivos } from "@/components/arquivos/AbaArquivos";
import { PedirAcessoDialog } from "@/components/arquivos/PedirAcessoDialog";
import { FaixaTriagem } from "@/components/triagem/FaixaTriagem";
import { FaixaPreVenda } from "@/components/prevenda/FaixaPreVenda";
import { VincularClienteModal } from "@/components/triagem/VincularClienteModal";
import { Customer } from "@/lib/store";
import { cn, getBrazilianPhoneVariations } from "@/lib/utils";

// Lazy Components - Keep only non-critical ones if any

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const { user } = useAuth();
  
  useRealtimeChat({ tenantId: user?.tenantId, userId: user?.id, enabled: !!user });  const conv = store.getConversation(id || "");
  const messages = store.getMessages(id || "");
  const notes = store.getNotes(id || "");
  const history = store.getHistory(id || "");
  const customer = store.getCustomer(conv?.customerId);
  const quickReplies = store.quickReplies;

  const [messageInput, setMessageInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [avatarSyncing, setAvatarSyncing] = useState(false);
  const [showPanel, setShowPanel] = useState<"customer" | "arquivos" | "members" | "notes" | "tags" | "history" | null>("customer");
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const EMOJIS = [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥴","😵","🤯","🥳","🥺","😢","😭","😤","😠","😡","🤬","👋","🤚","🖐","✋","🖖","🫶","👌","🤌","🤏","✌","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","💪","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👅","👄","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💕","💞","💓","💗","💖","💘","💝","💟","❣️","💌","💋","💯","💢","💥","💫","💦","💨","🕳️","💬","🗯️","🗨️","👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁️","👅","👄","🗣️","👤","👥","🫂","👶","👧","🧒","👦","👩","🧑","👨","👩‍🦱","🧑‍🦱","👩‍🦰","🧑‍🦰","👩‍🦳","🧑‍🦳","👩‍🦲","🧑‍🦲","👨‍🦱","👨‍🦰","👨‍🦳","👨‍🦲","👩‍🦱","🧑‍🦱","👩‍🦰","🧑‍🦰","👩‍🦳","🧑‍🦳","👩‍🦲","🧑‍🦲","👨‍🦱","👨‍🦰","👨‍🦳","👨‍🦲","🧔","🧔‍♂️","🧔‍♀️","👱‍♂️","👱‍♀️","👴","👵","🧓","🙍‍♂️","🙍‍♀️","🙎‍♂️","🙎‍♀️","🙅‍♂️","🙅‍♀️","🙆‍♂️","🙆‍♀️","💁‍♂️","💁‍♀️","🙋‍♂️","🙋‍♀️","🧏‍♂️","🧏‍♀️","🙇‍♂️","🙇‍♀️","🤦‍♂️","🤦‍♀️","🤷‍♂️","🤷‍♀️","👨‍⚕️","👩‍⚕️","👨‍🎓","👩‍🎓","👨‍🏫","👩‍🏫","👨‍⚖️","👩‍⚖️","👨‍🌾","👩‍🌾","👨‍🍳","👩‍🍳","👨‍🔧","👩‍🔧","👨‍🏭","👩‍🏭","👨‍💼","👩‍💼","👨‍🔬","👩‍🔬","👨‍💻","👩‍💻","👨‍🎤","👩‍🎤","👨‍🎨","👩‍🎨","👨‍✈️","👩‍✈️","👨‍🚀","👩‍🚀","👨‍🚒","👩‍🚒","🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🪺","🪹","🍄","🐚","🪸","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐","🌟","✨","⚡","☄️","💥","🔥","🌪️","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","🫧","☔","☂️","🌊","🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🫘","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🫗","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂","🎃","🎄","🎆","🎇","🧨","✨","🎈","🎉","🎊","🎋","🎍","🎎","🎏","🎐","🎑","🧧","🎀","🎁","🎗️","🎟️","🎫","🎖️","🏆","🏅","🥇","🥈","🥉","⚽","⚾","🥎","🏀","🏐","🏈","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸","🪃","🥅","🏹","🤿","🪀","🪁","🔫","🎱","🔮","🪄","🎮","🕹️","🎰","🎲","🧩","♟️","🎭","🎨","🧵","🧶","🎼","🎤","🎧","🎷","🎸","🎹","🎺","🎻","🪕","🥁","🪘","🎬","🎽","👟","🥾","🥿","👞","👟","🥾","🥿","👠","👡","🩰","👢","👑","👒","🎩","🎓","🧢","🪖","⛑️","📿","💄","💍","💎","🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦭","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","💐","🌸","💮","🪷","🏵️","🌹","🥀","🌺","🌻","🌼","🌷","🌱","🪴","🌲","🌳","🌴","🌵","🌾","🌿","☘️","🍀","🍁","🍂","🍃","🪺","🪹","🍄","🐚","🪸","🪨","🌊","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","🫧","☔","☂️","🌊","🌫️","🌪️","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","🫧","☔","☂️","🌊","🌫️","🌪️","🌈","🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🫘","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🫗","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂","🎉","🎊","🎈","🎁","🎀","🪅","🪆","🎃","🎄","🎆","🎇","🧨","✨","🎋","🎍","🎎","🎏","🎐","🎑","🧧","🎗️","🎟️","🎫","🎖️","🏆","🏅","🥇","🥈","🥉","⚽","⚾","🥎","🏀","🏐","🏈","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸","🪃","🥅","🏹","🤿","🪀","🪁","🔫","🎱","🔮","🪄","🎮","🕹️","🎰","🎲","🧩","♟️","🎭","🎨","🧵","🧶","🎼","🎤","🎧","🎷","🎸","🎹","🎺","🎻","🪕","🥁","🪘","🎬","🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","⚧️","🏴‍☠️","🇺🇳","🇧🇷","🇺🇸","🇬🇧","🇪🇸","🇫🇷","🇩🇪","🇮🇹","🇯🇵","🇨🇳","🇰🇷","🇷🇺","🇮🇳","🇦🇷","🇵🇹","🇲🇽","🇨🇱","🇨🇴","🇵🇾","🇺🇾","🇻🇪","🇪🇨","🇵🇪","🇧🇴",
  ];
  const rawParticipants = groupInfo?.participants || groupInfo?.data?.participants || [];
  const participants = Array.isArray(rawParticipants) ? rawParticipants : [];
  const subject = groupInfo?.subject || groupInfo?.data?.subject || conv?.clientName || "Grupo";
  const description = groupInfo?.desc || groupInfo?.data?.desc || "";
  const size = groupInfo?.size || groupInfo?.data?.size || participants.length;

  const filteredParticipants = participants.filter((p: any) => {
    if (!p) return false;
    const phone = String(p.id || p.jid || "");
    return phone.toLowerCase().includes(memberSearch.toLowerCase());
  });
  const [transferReason, setTransferReason] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingReason, setClosingReason] = useState<ClosingReason>("resolvido");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [msgToDelete, setMsgToDelete] = useState<{ msgId: string; externalId: string } | null>(null);

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

  useEffect(() => {
    if (showPanel === "members" && conv?.isGroup && conv?.clientPhone) {
      const loadGroupInfo = async () => {
        try {
          setLoadingGroupInfo(true);
          const res = await fetchGroupInfo(conv.clientPhone);
          if (res.success && res.data) {
            setGroupInfo(res.data);
          } else {
            console.error("Erro ao buscar info do grupo:", res?.error);
          }
        } catch (err) {
          console.error("Erro ao buscar info do grupo:", err);
        } finally {
          setLoadingGroupInfo(false);
        }
      };
      loadGroupInfo();
    }
  }, [showPanel, conv?.isGroup, conv?.clientPhone]);

  const [pedidoPendente, setPedidoPendente] = useState<any | null>(null);
  const [pedirAcessoParaPedido, setPedirAcessoParaPedido] = useState<any | null>(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  const fetchPedidoPendente = useCallback(async () => {
    if (!conv?.id || !user?.tenantId) return;

    try {
      const { data } = await supabase
        .from("vw_pedidos_documento_pendentes")
        .select("*")
        .eq("conversa_id", conv.id)
        .eq("status", "aguardando_envio")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPedidoPendente(data || null);
    } catch (err) {
      console.error("Erro ao buscar pedido pendente:", err);
    }
  }, [conv?.id, user?.tenantId]);

  const [oportunidadeAtiva, setOportunidadeAtiva] = useState<any | null>(null);

  const fetchOportunidade = useCallback(async () => {
    if (!conv?.id || !user?.tenantId) return;
    try {
      const { data } = await supabase
        .from("oportunidades")
        .select("*")
        .eq("conversa_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setOportunidadeAtiva(data || null);
    } catch (e) {
      console.error("Erro ao buscar oportunidade da conversa:", e);
    }
  }, [conv?.id, user?.tenantId]);

  useEffect(() => {
    if (conv?.funil === "pre_venda") {
      fetchOportunidade();
    } else {
      setOportunidadeAtiva(null);
    }
  }, [conv?.id, conv?.funil, fetchOportunidade]);

  useEffect(() => {
    fetchPedidoPendente();

    if (!conv?.id) return;
    const channel = supabase
      .channel(`pedidos-doc-${conv.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos_documento",
          filter: `conversa_id=eq.${conv.id}`,
        },
        () => {
          fetchPedidoPendente();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conv?.id, fetchPedidoPendente]);

  useEffect(() => {
    if (conv?.isGroup) {
      setShowPanel("members");
    } else {
      setShowPanel("customer");
    }
  }, [conv?.id, conv?.isGroup]);

  const formatJidToPhone = (jid: any) => {
    if (typeof jid !== 'string') return "";
    const raw = jid.split("@")[0];
    if (raw.startsWith("55") && raw.length >= 12) {
      const ddd = raw.slice(2, 4);
      const firstPart = raw.slice(4, -4);
      const lastPart = raw.slice(-4);
      return `+55 (${ddd}) ${firstPart}-${lastPart}`;
    }
    return `+${raw}`;
  };

  const handleStartPrivateChat = async (participantJid: string) => {
    const cleanPhone = participantJid.split("@")[0];
    
    // Buscar conversa no store usando variações de telefone brasileiro
    const variations = getBrazilianPhoneVariations(cleanPhone);
    const existing = store.conversations.find(c => variations.includes(c.clientPhone.replace(/\D/g, "")) && !c.isGroup);
    if (existing) {
      navigate(`/chat/${existing.id}`);
      return;
    }
    
    // Buscar conversa no DB usando variações
    const { data: dbConv } = await supabase
      .from("conversas")
      .select("*")
      .in("client_phone", variations)
      .eq("tenant_id", user?.tenantId)
      .eq("is_group", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (dbConv) {
      store.addDbConversation({
        id: dbConv.id,
        clientName: dbConv.client_name,
        clientPhone: dbConv.client_phone,
        customerId: dbConv.customer_id,
        lastMessage: dbConv.last_message,
        lastMessageTime: new Date(dbConv.last_message_time),
        status: dbConv.status as any,
        assignedTo: dbConv.assigned_to,
        tenantId: dbConv.tenant_id,
        isGroup: dbConv.is_group,
        protocolo: dbConv.protocolo,
        resolvedAt: dbConv.resolved_at,
        funil: dbConv.funil,
        arquivoMotivo: dbConv.arquivo_motivo
      });
      navigate(`/chat/${dbConv.id}`);
      return;
    }
    
    // Abrir NewChatDialog pré-preenchido
    window.dispatchEvent(new CustomEvent("open-new-chat", { detail: { phone: cleanPhone } }));
  };


  const handleReactionSelect = async (emoji: string) => {
    if (!reactionMenuOpen || !conv?.clientPhone) return;
    
    const targetMsg = messages.find(m => m.id === reactionMenuOpen.id);
    const externalId = reactionMenuOpen.externalId;
    
    // Fechar o menu IMEDIATAMENTE para dar feedback visual
    setReactionMenuOpen(null);
    
    try {
      const res = await sendReaction(
        conv.clientPhone, 
        externalId, 
        emoji,
        targetMsg?.message_key_json
      );
      
      if (res.success) {
        toast.success("Reação enviada!");
        
        // Atualização Otimista: Store Local
        storeRef.current.updateMessageReaction(reactionMenuOpen.id, emoji);
        
        // Atualização Otimista: Banco de Dados
        await supabase.from("mensagens")
          .update({ reaction: emoji })
          .eq("id", reactionMenuOpen.id);

      } else {
        toast.error("Erro ao reagir: " + (res.error || "Desconhecido"));
      }
    } catch (err) {
      toast.error("Erro ao reagir");
      console.error(err);
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

    const handleDelete = (e: any) => {
      const { msgId, externalId } = e.detail;
      setMsgToDelete({ msgId, externalId });
      setDeleteConfirmOpen(true);
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
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
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

  // Carregar tags do banco
  useEffect(() => {
    if (!user?.tenantId) return;
    supabase
      .from("tags")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          store.setTags(data.map(t => ({ id: t.id, name: t.nome, color: t.cor || "#6B7280" })));
        }
      });
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

  const viewedRef = useRef<Set<string>>(new Set());
  // Sincroniza o histórico da Evolution no máximo uma vez por conversa aberta
  const historySyncedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    setGroupInfo(null);
    setMemberSearch("");

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
              isGroup: dbConv.is_group,
              protocolo: dbConv.protocolo,
              resolvedAt: dbConv.resolved_at,
              funil: dbConv.funil,
              arquivoMotivo: dbConv.arquivo_motivo
            });
          }
        }

        const { data: dbMsgs } = await supabase
          .from("mensagens")
          .select("*")
          .eq("conversation_id", id)
          .order("timestamp", { ascending: true });
          
        if (dbMsgs) {
          storeRef.current.syncConversationMessages(id!, dbMsgs.map(m => ({
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

        // Registrar visualização (uma vez por usuário)
        if (user && !viewedRef.current.has(`${id}-${user.id}`)) {
          viewedRef.current.add(`${id}-${user.id}`);
          const { data: existingView } = await supabase
            .from("historico")
            .select("id")
            .eq("conversation_id", id)
            .eq("action", `Visualizado por ${user.name}`)
            .maybeSingle();
          if (!existingView) {
          await insertHistorico({
            conversation_id: id,
            action: `Visualizado por ${user.name}`,
            user_id: user.id,
            user_name: user.name,
            timestamp: new Date().toISOString()
          });
            storeRef.current.addDbHistory([{
              id: `view-${Date.now()}`,
              conversationId: id,
              action: `Visualizado por ${user.name}`,
              userId: user.id,
              userName: user.name,
              timestamp: new Date()
            }]);
          }
        }

        // Se tiver poucas mensagens no banco, sincronizar histórico da Evolution
        const currentConv = conv || storeRef.current.getConversation(id || "");
        if (dbMsgs && dbMsgs.length < 15 && currentConv?.clientPhone && !historySyncedRef.current.has(id!)) {
          historySyncedRef.current.add(id!);
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
              
              const rawType = msgContent.audioMessage ? 'audio'
                : msgContent.imageMessage ? 'image'
                : msgContent.videoMessage ? 'video'
                : msgContent.documentMessage ? 'document'
                : msgContent.reactionMessage ? 'reaction'
                : 'text';

              const mediaLabels: Record<string, string> = {
                audio: '[Áudio]',
                image: '[Imagem]',
                video: '[Vídeo]',
                document: '[Documento]'
              };

              // Mídias do histórico não podem ser baixadas — salvar como texto
              const syncType = mediaLabels[rawType] ? 'text' : rawType;
              const syncContent = syncType === 'text'
                ? (text || mediaLabels[rawType] || '')
                : text;

              // Se for reação, o wa_message_id da LINHA deve ser o da mensagem original reagida
              const waMessageId = (rawType === 'reaction') ? (msgContent.reactionMessage?.key?.id || key.id) : key.id;
              
              // Upsert — não duplica se já existir
              await supabase.from("mensagens").upsert({
                conversation_id: id,
                content: syncContent,
                sender: key.fromMe ? "agent" : "client",
                sender_name: key.fromMe ? "WhatsApp" : (m.pushName || currentConv.clientPhone),
                type: syncType,
                timestamp: new Date((m.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                external_message_id: key.id,
                wa_message_id: waMessageId,
                remote_jid: key.remoteJid,
                from_me: key.fromMe,
                participant: key.participant,
                message_key_json: key,
                instance_name: instanceName,
                status: key.fromMe ? "sent" : "delivered",
                tenant_id: user?.tenantId
              }, { onConflict: "external_message_id" });

              // Se for reação, atualizar a mensagem original e a tabela de auditoria
              if (rawType === 'reaction' && waMessageId) {
                const reactionEmoji = (msgContent.reactionMessage?.text || "").trim();
                await supabase.from("mensagens").update({ reaction: reactionEmoji }).eq("external_message_id", waMessageId);
                
                try {
                  await supabase.from("message_reactions").upsert({
                    tenant_id: user?.tenantId,
                    instance_name: instanceName,
                    wa_message_id: waMessageId,
                    reaction: reactionEmoji,
                    reacted_by_jid: key.remoteJid,
                    from_me: !!key.fromMe,
                    participant: key.participant || null,
                    raw_payload: msgContent.reactionMessage
                  }, { onConflict: 'wa_message_id,reacted_by_jid' });
                } catch (e) { /* Coluna pode não existir ainda */ }
              }
            }
            
            // Recarregar mensagens após sync
            const { data: refreshed } = await supabase
              .from("mensagens")
              .select("*")
              .eq("conversation_id", id)
              .order("timestamp", { ascending: true });
              
            if (refreshed) {
              storeRef.current.syncConversationMessages(id!, refreshed.map(m => ({
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
    // Mensagens novas chegam pelo realtime (useRealtimeChat). Este polling é só
    // uma rede de segurança caso o websocket caia — antes rodava a cada 3s.
    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") loadRealData();
    }, 30000);
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

  const appendFiles = (files: File[]) => {
    if (!files || files.length === 0) return;
    const newFiles = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ""
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    appendFiles(files);
    if (e.target) e.target.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      appendFiles(files);
      toast.success(`${files.length} arquivo${files.length > 1 ? "s" : ""} anexado${files.length > 1 ? "s" : ""}!`);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => {
      const target = prev[index];
      if (target.preview && target.preview.startsWith('blob:')) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
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
    if ((!messageInput.trim() && selectedFiles.length === 0 && !audioBlob) || !user || !conv) return;
    if (conv.assignedTo !== user.id && user.role !== "admin") {
      toast.error("Você precisa assumir esta conversa antes de responder.");
      return;
    }

    const tStart = performance.now();
    console.log(`[TIMING] handleSend iniciado: ${new Date().toISOString()}`);

    // IMPLEMENTAÇÃO 10: Parar typing indicator ao enviar
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTypingStatus(conv.clientPhone, false);

    const toastId = toast.loading("Enviando...");
    
    try {
      if (selectedFiles.length > 0) {
        // Enviar os arquivos um por um
        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          const file = item.file;
          
          let fileType: MessageType = 'text';
          if (file.type.startsWith('image/')) fileType = 'image';
          else if (file.type.startsWith('video/')) fileType = 'video';
          else fileType = 'document';

          // Upload do arquivo
          const mediaUrl = await uploadFile(file, file.name);

          // Enviar legenda do primeiro arquivo
          const caption = i === 0 ? messageInput : "";

          const res = await sendMediaMessage(conv.clientPhone, mediaUrl, fileType as any, file.name, caption);
          if (!res.success) throw new Error(res.error);
          
          const extId = res.data?.key?.id;
          
          store.sendMessage(id!, caption, user, { 
            type: fileType, 
            mediaUrl, 
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            status: 'sent',
            external_message_id: extId
          });

          await supabase.from("mensagens").insert({
            conversation_id: id,
            content: caption,
            sender: "agent",
            sender_name: user.name,
            type: fileType,
            media_url: mediaUrl,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            external_message_id: extId,
            status: 'sent',
            tenant_id: user.tenantId
          });
        }

        await supabase.from("conversas").update({
          last_message: messageInput || "[Mídia]",
          last_message_time: new Date().toISOString(),
          tenant_id: user.tenantId
        }).eq("id", id);

        // Limpar arquivos após enviar
        setSelectedFiles([]);
      } else if (audioBlob) {
        const mediaUrl = await uploadFile(audioBlob, 'audio.ogg');
        const type = 'audio';
        
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

        await supabase.from("conversas").update({
          last_message: "[Áudio]",
          last_message_time: new Date().toISOString(),
          tenant_id: user.tenantId
        }).eq("id", id);
      } else {
        const textToSend = messageInput;
        const currentReplying = replyingTo;
        const tempMsgId = `temp-${Date.now()}`;

        // Limpar input imediatamente para sensação instantânea estilo WhatsApp
        setMessageInput("");
        setReplyingTo(null);
        toast.dismiss(toastId);

        const quotedData = currentReplying ? {
          id: currentReplying.id,
          content: currentReplying.content,
          sender: currentReplying.senderName
        } : undefined;

        // Inserir imediatamente com status 'sending' (1 check ✓)
        store.addDbMessages([{
          id: tempMsgId,
          conversationId: id!,
          content: textToSend,
          sender: "agent",
          senderName: user.name,
          timestamp: new Date(),
          type: "text",
          status: "sending",
          quotedMessage: quotedData
        }]);

        // Atualizar última mensagem na lista
        store.addDbConversation({
          id: id!,
          lastMessage: textToSend,
          lastMessageTime: new Date()
        } as any);

        try {
          const res = await sendWhatsAppMessage(conv.clientPhone, textToSend, user.name, currentReplying?.external_message_id);
          if (!res.success) throw new Error(res.error || "Falha ao enviar mensagem");

          const extId = res.data?.key?.id;

          // Atualizar para status 'sent' (2 checks ✓✓)
          store.updateMessage(tempMsgId, {
            status: "sent",
            external_message_id: extId
          });

          await supabase.from("mensagens").insert({
            conversation_id: id,
            content: textToSend,
            sender: "agent",
            sender_name: user.name,
            type: 'text',
            external_message_id: extId,
            status: 'sent',
            tenant_id: user.tenantId,
            quoted_message: quotedData
          });

          await supabase.from("conversas").update({
            last_message: textToSend,
            last_message_time: new Date().toISOString(),
            tenant_id: user.tenantId
          }).eq("id", id);
        } catch (sendErr: any) {
          console.error("Erro ao enviar mensagem no WhatsApp:", sendErr);
          store.updateMessage(tempMsgId, { status: "error" });
          toast.error("Não foi possível enviar a mensagem. Verifique a conexão.");
        }
      }

      const tEnd = performance.now();
      const tDelta = (tEnd - tStart).toFixed(0);
      console.log(`[TIMING] handleSend concluído: ${new Date().toISOString()} (${tDelta}ms)`);
      if (Number(tDelta) > 3000) {
        console.warn(`[TIMING] ALERTA: Envio lento! ${tDelta}ms`);
      }

      clearAudio();
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
    if (!finalMessage.trim() && selectedFiles.length === 0) {
      toast.error("Adicione uma mensagem para agendar");
      return;
    }

    try {
      let mediaUrl = "";
      let type: MessageType = 'text';
      
      if (selectedFiles.length > 0) {
        const primaryFile = selectedFiles[0].file;
        mediaUrl = await uploadFile(primaryFile, primaryFile.name);
        if (primaryFile.type.startsWith('image/')) type = 'image';
        else if (primaryFile.type.startsWith('video/')) type = 'video';
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
          mime_type: selectedFiles[0]?.file.type || null,
          file_name: selectedFiles[0]?.file.name || null,
          scheduled_at: scheduledAt.toISOString(),
          status: 'agendada',
          created_by: user?.id
        });
      
      console.log("Agendamento enviado com sucesso - v2");

      if (error) throw error;
      
      toast.success(`Agendado para ${format(scheduledAt, "PPp", { locale: ptBR })}`);
      setMessageInput("");
      setSelectedFiles([]);
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
      await insertHistorico({
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
      const originalSender = forwardingMsg.sender === 'client' ? (conv?.clientName || "Cliente") : (forwardingMsg.senderName || "Atendente");
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
          caption
        );
      }

      if (!res.success) throw new Error(res.error);

      const cleanPhone = targetPhone.replace(/\D/g, "");
      if (cleanPhone.length < 10) throw new Error("Telefone inválido");

      const variations = getBrazilianPhoneVariations(cleanPhone);
      let { data: targetConv, error: fetchError } = await supabase
        .from("conversas")
        .select("*")
        .in("client_phone", variations)
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const lastMsgText = forwardingMsg.type === 'text' || !forwardingMsg.type ? caption : `[${forwardingMsg.type}]`;

      if (!targetConv) {
        let protocolo = null;
        try {
          const { data: protoResult, error: protoError } = await supabase
            .rpc('get_next_protocolo', { p_tenant_id: user.tenantId })
            .single();
          if (protoError) {
            console.error(`[ChatPage] Erro ao gerar protocolo: ${protoError.message}`);
          } else if (protoResult) {
            protocolo = typeof protoResult === 'object' && protoResult !== null
              ? ((protoResult as any).get_next_protocolo ?? null)
              : protoResult;
          }
        } catch (e) {
          console.error("[ChatPage] Erro ao gerar protocolo:", e);
        }

        const { data: newConv, error: createError } = await supabase
          .from("conversas")
          .insert({
            client_name: cleanPhone,
            client_phone: cleanPhone,
            last_message: lastMsgText,
            last_message_time: new Date().toISOString(),
            status: "em_atendimento",
            assigned_to: user.id,
            tenant_id: user.tenantId,
            protocolo: protocolo
          })
          .select()
          .single();

        if (createError) throw createError;
        targetConv = newConv;

        if (protocolo) {
          await insertHistorico({
            conversation_id: targetConv.id,
            action: "Chamado criado",
            details: `Protocolo: #${protocolo}`,
            user_id: user.id,
            user_name: user.name
          });
        }
      } else {
        await supabase
          .from("conversas")
          .update({
            last_message: lastMsgText,
            last_message_time: new Date().toISOString(),
            status: "em_atendimento",
            assigned_to: user.id
          })
          .eq("id", targetConv.id);
      }

      const extId = res.data?.key?.id || res.data?.messageId || `fwd-${Date.now()}`;

      const { data: insertedMsg, error: insertError } = await supabase
        .from("mensagens")
        .insert({
          conversation_id: targetConv.id,
          content: forwardingMsg.type === 'text' || !forwardingMsg.type ? caption : (forwardingMsg.content || `[${forwardingMsg.type}]`),
          sender: "agent",
          sender_name: user.name,
          type: forwardingMsg.type || 'text',
          media_url: forwardingMsg.mediaUrl || null,
          file_name: forwardingMsg.fileName || null,
          mime_type: forwardingMsg.mimeType || null,
          file_size: forwardingMsg.fileSize || null,
          external_message_id: extId,
          status: 'sent',
          tenant_id: user.tenantId
        })
        .select()
        .single();

      if (insertError) throw insertError;

      storeRef.current.addDbConversation({
        id: targetConv.id,
        clientName: targetConv.client_name,
        clientPhone: targetConv.client_phone,
        customerId: targetConv.customer_id,
        lastMessage: lastMsgText,
        lastMessageTime: new Date(),
        status: targetConv.status as any,
        assignedTo: targetConv.assigned_to,
        tenantId: targetConv.tenant_id,
        isGroup: targetConv.is_group,
        funil: targetConv.funil,
        arquivoMotivo: targetConv.arquivo_motivo
      });

      if (insertedMsg) {
        storeRef.current.addDbMessages([{
          id: insertedMsg.id,
          conversationId: targetConv.id,
          content: insertedMsg.content,
          sender: "agent",
          senderName: user.name,
          timestamp: new Date(insertedMsg.timestamp),
          type: insertedMsg.type as MessageType,
          mediaUrl: insertedMsg.media_url,
          fileName: insertedMsg.file_name,
          mimeType: insertedMsg.mime_type,
          fileSize: insertedMsg.file_size,
          status: 'sent',
          external_message_id: extId
        }]);
      }

      await insertHistorico({
        conversation_id: targetConv.id,
        action: "Mensagem encaminhada",
        user_id: user.id,
        user_name: user.name,
        details: `Mensagem encaminhada por ${user.name} (Original: ${originalSender})`
      });

      toast.success("Mensagem encaminhada!", { id: toastId });
      setForwardModalOpen(false);
      setForwardingMsg(null);
    } catch (err) {
      console.error(err);
      toast.error(`Erro ao encaminhar: ${String(err)}`, { id: toastId });
    }
  };

  const confirmDeleteMessage = async () => {
    if (!msgToDelete || !conv?.clientPhone) return;
    const { msgId, externalId } = msgToDelete;
    const msg = storeRef.current.getMessages(id || "").find(m => m.id === msgId);
    const prevContent = msg?.content;
    const prevType = msg?.type;
    const toastId = toast.loading("Apagando mensagem...");

    // Atualiza store e DB imediatamente
    storeRef.current.updateMessage(msgId, { content: "Mensagem apagada", type: "revoke", mediaUrl: undefined, fileName: undefined, reaction: undefined });
    await supabase.from("mensagens").update({ content: "Mensagem apagada", type: "revoke", media_url: null, file_name: null, mime_type: null, file_size: null, reaction: null }).eq("id", msgId);

    try {
      const res = await deleteMessage(conv.clientPhone, externalId, msg?.message_key_json);
      if (res.success) {
        toast.success("Mensagem apagada!", { id: toastId });
      } else {
        toast.error(`Erro ao apagar mensagem no WhatsApp: ${res.error || "Erro desconhecido"}`, { id: toastId });
      }
    } catch (err) {
      console.error("Erro ao apagar:", err);
      toast.error("Erro ao apagar mensagem", { id: toastId });
    } finally {
      setDeleteConfirmOpen(false);
      setMsgToDelete(null);
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
      await insertHistorico({
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
        .update({ 
          status: "resolvido", 
          resolved_at: new Date().toISOString(),
          assigned_to: null
        })
        .eq("id", id);
      if (error) throw error;

      await insertHistorico([{
        conversation_id: id,
        action: `Atendimento encerrado`,
        user_id: user.id,
        user_name: user.name,
        details: `Motivo: ${closingReason}`
      }, {
        conversation_id: id,
        action: `Chamado resolvido`,
        user_id: user.id,
        user_name: user.name,
        details: `Responsável removido automaticamente.`
      }]);

      store.updateStatus(id!, "resolvido", user!, closingReason);
      store.addDbConversation({ id: id!, assignedTo: undefined } as any);
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
      await insertHistorico({
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
      
      await insertHistorico({
        conversation_id: id,
        customer_id: customerData.id,
        action: "Cliente vinculado via CNPJ",
        user_id: user?.id,
        user_name: user?.name,
        details: logDetails,
        timestamp: new Date().toISOString()
      });

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
  const isSupervisor = user.role === "supervisor";
  const isAssigned = conv.assignedTo === user.id;
  const canRespond = isAssigned || isAdmin;
  const slaStatus = store.getSLAStatus(conv);

  // Atendente que abrir conversa de pré-venda vê "Conversa restrita à pré-venda"
  if (conv.funil === "pre_venda" && !isAdmin && !isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-88px)] bg-card rounded-2xl mx-8 mb-8 border border-border p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground mb-1">Conversa restrita à pré-venda</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Este contato foi classificado como uma oportunidade comercial e seu atendimento é restrito aos administradores e supervisores.
        </p>
        <Button onClick={() => navigate("/")} className="font-bold">
          Voltar para a Caixa de Entrada
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-88px)] gap-5 px-8 pb-8">
      {/* Main Chat Area */}
      <div 
        className={cn(
          "relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card transition-colors",
          isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl animate-in fade-in duration-200 pointer-events-none">
            <div className="p-4 bg-primary/10 text-primary rounded-full mb-3">
              <UploadCloud className="w-10 h-10 animate-bounce" />
            </div>
            <p className="text-lg font-bold text-foreground">Solte o arquivo ou imagem aqui</p>
            <p className="text-xs text-muted-foreground mt-1">O arquivo será preparado como anexo para o envio</p>
          </div>
        )}

        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-border px-5 py-3.5">
          <Button variant="outline" size="icon" onClick={() => navigate("/")} className="h-9 w-9" aria-label="Voltar para a caixa de entrada">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <button
            type="button"
            aria-label="Buscar foto do perfil"
            disabled={avatarSyncing}
            className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={async () => {
              if ((conv.clientAvatar?.includes('supabase.co') ?? false) || conv.isGroup) return;
              setAvatarSyncing(true);
              try {
                const res = await fetch('/api/sync-avatar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ conversationId: conv.id })
                });
                const data = await res.json();
                if (data.ok && data.url) {
                  store.addDbConversation({ id: conv.id, clientAvatar: data.url } as any);
                  toast.success('Foto carregada!');
                } else {
                  toast.error(data.message || 'Sem foto disponível');
                }
              } catch {
                toast.error('Erro ao buscar foto');
              } finally {
                setAvatarSyncing(false);
              }
            }}
            title={conv.clientAvatar?.includes('supabase.co') ? '' : 'Clique para buscar foto do perfil'}
          >
            <InitialsAvatar
              name={conv.clientName}
              src={conv.clientAvatar}
              size={42}
              icon={avatarSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : conv.isGroup ? <Users className="h-5 w-5" /> : undefined}
              onImageError={() => {
                if (conv.clientAvatar?.includes('whatsapp.net') && !conv.isGroup) {
                  fetch('/api/sync-avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversationId: conv.id })
                  }).then(r => r.json()).then(d => {
                    if (d.ok && d.url) store.addDbConversation({ id: conv.id, clientAvatar: d.url } as any);
                  }).catch(() => {});
                }
              }}
            />
          </button>
          <div className="min-w-[180px] flex-1">
            <p className="truncate text-base font-extrabold">
              {conv.clientName}
              {conv.protocolo && <span className="ml-2 text-xs font-semibold text-muted-foreground">#{conv.protocolo}</span>}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {conv.isTyping ? (
                <span className="text-xs text-primary font-medium animate-pulse flex items-center gap-1">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                  digitando...
                </span>
              ) : (
                <>
                  {conv.funil === "pre_venda" && (
                    <Chip tone="amber" className="gap-1 font-bold">
                      <Sparkles className="h-3 w-3" />
                      Pré-venda · {oportunidadeAtiva?.etapa ? oportunidadeAtiva.etapa.replace("_", " ") : "lead"}
                    </Chip>
                  )}
                  {conv.funil === "triagem" && (
                    <Chip tone="blue" className="gap-1 font-bold">
                      Triagem
                    </Chip>
                  )}
                  <StatusBadge status={conv.status} />
                  <SLABadge slaStatus={slaStatus} />
                </>
              )}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSyncHistory}
              disabled={syncing}
              className="h-9 w-9"
              aria-label="Sincronizar histórico do WhatsApp"
              title="Sincronizar histórico do WhatsApp"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            </Button>
            {!isAssigned && (
              <Button size="sm" onClick={handleAssume}>Assumir</Button>
            )}
            {!customer && (
              <SimpleContactDialog 
                initialPhone={conv.clientPhone} 
                initialName={conv.clientName === conv.clientPhone ? "" : conv.clientName}
                onSuccess={handleCustomerCreated}
                trigger={
                  <Button size="sm" variant="success" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Salvar contato
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
                    <Button size="sm" variant="success">Encerrar</Button>
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

        {/* Faixa de triagem no topo da conversa sem cliente */}
        {!conv.customerId && (conv.funil === "triagem" || !conv.funil) && (
          <FaixaTriagem
            conversaId={conv.id}
            telefone={conv.clientPhone}
            nomeCliente={conv.clientName}
            onAtualizado={() => {
              navigate("/");
            }}
          />
        )}

        {/* Faixa de pré-venda com botões Ganhar / Perder direto na conversa */}
        {!conv.customerId && conv.funil === "pre_venda" && (
          <FaixaPreVenda
            conversaId={conv.id}
            onAtualizado={() => {
              // Recarregar dados ou navegar para atendimento
              navigate("/");
            }}
          />
        )}

        {/* Faixa de pedido "um clique" no topo da conversa */}
        {pedidoPendente && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-950 dark:text-amber-200 truncate">
                  {pedidoPendente.contato_nome || "Contato"} {pedidoPendente.contato_papel ? `(${pedidoPendente.contato_papel})` : ""} pediu:{" "}
                  <span className="font-extrabold text-foreground">{pedidoPendente.rotulo || pedidoPendente.tipo}</span>
                  {pedidoPendente.nome_arquivo ? ` · ${pedidoPendente.nome_arquivo}` : ""}
                </p>
                <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                  Documento pronto para envio em um clique
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                disabled={enviandoPedido}
                onClick={async () => {
                  try {
                    await supabase
                      .from("pedidos_documento")
                      .update({ status: "recusado", motivo: "Recusado pela atendente" })
                      .eq("id", pedidoPendente.id);
                    toast.info("Pedido de documento recusado.");
                    fetchPedidoPendente();
                  } catch (e: any) {
                    toast.error(e.message || "Erro ao recusar pedido");
                  }
                }}
              >
                Recusar
              </Button>

              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={enviandoPedido}
                onClick={async () => {
                  setEnviandoPedido(true);
                  try {
                    // Checar se o usuário tem permissão para a área
                    const docArea = pedidoPendente.tipo === "folha_pagamento" ? "rh"
                      : ["faturamento", "compras", "vendas", "boletos_honorarios"].includes(pedidoPendente.tipo) ? "financeiro"
                      : "geral";

                    const { data: temAcesso } = await supabase.rpc("usuario_tem_acesso", {
                      p_usuario: user.id,
                      p_cliente: pedidoPendente.cliente_id,
                      p_area: docArea,
                    });

                    if (!temAcesso && ["rh", "financeiro", "certificado"].includes(docArea)) {
                      setPedirAcessoParaPedido({ area: docArea, ...pedidoPendente });
                      setEnviandoPedido(false);
                      return;
                    }

                    if (!conv.clientPhone || !pedidoPendente.documento_id) {
                      throw new Error("Telefone ou arquivo do documento não disponível");
                    }

                    const caption = `Segue seu documento: ${pedidoPendente.rotulo || pedidoPendente.nome_arquivo}`;
                    const arquivoUrl = await linkDoDocumento(pedidoPendente.documento_id, user.id);
                    const sent = await sendMediaMessage(
                      conv.clientPhone,
                      arquivoUrl,
                      "document",
                      pedidoPendente.nome_arquivo || "documento.pdf",
                      caption
                    );

                    if (sent?.success) {
                      await supabase.rpc("marcar_pedido_enviado", {
                        p_pedido: pedidoPendente.id,
                        p_usuario: user.id,
                      });
                      toast.success("Documento enviado com sucesso ao cliente!");
                      fetchPedidoPendente();
                    } else {
                      throw new Error("Falha no envio pelo WhatsApp");
                    }
                  } catch (err: any) {
                    console.error("Erro ao enviar pedido um-clique:", err);
                    toast.error(err.message || "Erro ao enviar documento");
                  } finally {
                    setEnviandoPedido(false);
                  }
                }}
              >
                {enviandoPedido ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        )}

        {/* Diálogo de Pedir Acesso acionado pelo banner */}
        {pedirAcessoParaPedido && user?.id && (
          <PedirAcessoDialog
            open={!!pedirAcessoParaPedido}
            onOpenChange={(open) => !open && setPedirAcessoParaPedido(null)}
            userId={user.id}
            clienteId={pedirAcessoParaPedido.cliente_id}
            clienteNome={pedirAcessoParaPedido.empresa || "Cliente"}
            area={pedirAcessoParaPedido.area}
            conversaId={conv.id}
            onSuccess={() => {
              setPedirAcessoParaPedido(null);
              fetchPedidoPendente();
            }}
          />
        )}

        {/* Messages List */}
        <div className="flex-1 space-y-1 overflow-y-auto bg-muted/30 px-5 py-5">
          {(() => {
            // Criar mapa de reações
            const reactionMap: Record<string, string> = {};
            messages.forEach(m => {
              const t = m.type?.toLowerCase();
              if (t === 'reaction' && m.wa_message_id && m.content) {
                // Se o conteúdo for vazio, remove a reação
                const reactionEmoji = m.content.replace(/^Reagiu com /, "").trim();
                reactionMap[m.wa_message_id] = reactionEmoji;
              }
            });

            // Filtrar mensagens que não devem aparecer como balões
            return messages
              .filter(msg => {
                const t = msg.type?.toLowerCase();
                return t !== 'reaction';
              })
              .map((msg) => {
                // Anexar reação se existir no mapa
                const reaction = reactionMap[msg.external_message_id || ''] || msg.reaction;
                return (
                  <MessageBubble 
                    key={msg.id} 
                    msg={{ ...msg, reaction }} 
                    clientName={conv.clientName} 
                  />
                );
              });
          })()}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border px-4 py-3.5">
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
              {(selectedFiles.length > 0 || audioBlob) && (
                <div className="flex flex-col gap-2 p-2 bg-primary/5 border rounded-lg animate-in slide-in-from-bottom-2">
                  {selectedFiles.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 max-h-[100px] scrollbar-thin">
                      {selectedFiles.map((item, index) => {
                        const isImage = item.file.type.startsWith('image/');
                        const isVideo = item.file.type.startsWith('video/');
                        return (
                          <div key={index} className="flex items-center gap-2 p-1.5 bg-background border rounded-lg shrink-0 max-w-[180px] group relative">
                            {isImage ? (
                              <img src={item.preview} className="w-10 h-10 rounded-md object-cover border" />
                            ) : (
                              <div className="w-10 h-10 bg-primary/5 rounded-md flex items-center justify-center border text-primary">
                                {isVideo ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1 pr-4">
                              <p className="text-[10px] font-medium truncate leading-tight">{item.file.name}</p>
                              <p className="text-[8px] text-muted-foreground">{(item.file.size / 1024).toFixed(0)} KB</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveFile(index)} 
                              className="h-5 w-5 rounded-full absolute -top-1 -right-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm p-0 flex items-center justify-center"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {audioBlob && (
                    <div className="flex items-center gap-3 p-1.5 bg-background border rounded-lg">
                      <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center border">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-primary hover:bg-primary/20"
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
                          {isPreviewPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium truncate">Áudio Gravado</p>
                        <p className="text-[8px] text-muted-foreground">{recordingTime}s - {isPreviewPlaying ? 'Reproduzindo...' : 'Clique para ouvir'}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { clearAudio(); setIsPreviewPlaying(false); audioPreviewRef.current = null; }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
                <div className="flex gap-1 mb-1">
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" aria-label="Emojis">
                        <Smile className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-[320px] p-2">
                      <div className="max-h-[250px] overflow-y-auto flex flex-wrap gap-1">
                        {EMOJIS.map((emoji, i) => (
                          <button
                            key={i}
                            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded-md transition-colors"
                            onClick={() => {
                              setMessageInput(prev => prev + emoji);
                              setShowEmojiPicker(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-primary" aria-label="Anexar arquivo">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <ScheduleMessageDialog 
                    initialMessage={messageInput}
                    onSchedule={handleSchedule} 
                    trigger={
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" aria-label="Agendar mensagem">
                        <Clock className="w-5 h-5" />
                      </Button>
                    } 
                  />
                  <Popover open={showQuickReplies} onOpenChange={setShowQuickReplies}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" aria-label="Respostas rápidas">
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
                      aria-label="Mensagem"
                      className="min-h-[44px] h-11 resize-none rounded-[22px] border-none bg-secondary px-4 py-3 focus-visible:ring-1"
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                    />
                  )}
                </div>

                {(!messageInput.trim() && selectedFiles.length === 0 && !isRecording) ? (
                  <Button size="icon" className="h-11 w-11 rounded-full" onClick={startRecording} aria-label="Gravar áudio"><Mic className="w-5 h-5" /></Button>
                ) : (
                  <Button size="icon" className="h-11 w-11 rounded-full" onClick={handleSend} disabled={isRecording} aria-label="Enviar"><Send className="w-5 h-5" /></Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Panel */}
      <div className="hidden w-[300px] shrink-0 flex-col gap-4 lg:order-first lg:flex 2xl:w-[340px]">
        {conv.status !== "resolvido" && conv.slaDeadline && (() => {
          const start = (conv.startedAt ?? conv.lastMessageTime).getTime();
          const end = new Date(conv.slaDeadline).getTime();
          const nowMs = Date.now();
          const total = Math.max(end - start, 1);
          const pct = Math.min(100, Math.max(0, ((nowMs - start) / total) * 100));
          const mins = (ms: number) => {
            const m = Math.round(Math.abs(ms) / 60000);
            return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
          };
          const bar = slaStatus === "estourado" ? "bg-destructive" : slaStatus === "em_risco" ? "bg-amber-500" : "bg-success";
          return (
            <section className="flex flex-col gap-3 rounded-xl bg-card p-5">
              <p className="text-[11px] text-muted-foreground">Tempo de resposta (SLA)</p>
              <p className="-mt-2 text-[15px] font-extrabold">
                {slaStatus === "estourado"
                  ? `Estourado há ${mins(nowMs - end)}`
                  : `Responder até ${new Date(end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${bar}`} />{mins(nowMs - start)} decorridos</span>
                {slaStatus !== "estourado" && (
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />{mins(end - nowMs)} restantes</span>
                )}
              </div>
            </section>
          );
        })()}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
        <div className="flex border-b border-border">
          {[
            { key: "customer" as const, icon: User, label: "Cliente" },
            { key: "arquivos" as const, icon: FolderOpen, label: "Arquivos" },
            ...(conv?.isGroup ? [{ key: "members" as const, icon: Users, label: "Membros" }] : []),
            { key: "notes" as const, icon: StickyNote, label: "Notas" },
            { key: "tags" as const, icon: Tag, label: "Tags" },
            { key: "history" as const, icon: History, label: "Log" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setShowPanel(tab.key)}
              className={`flex-1 py-3 text-[11px] font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${showPanel === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {showPanel === "customer" && (
            <div className="space-y-4">
              {/* Bloco de Oportunidade da Pré-venda */}
              {conv.funil === "pre_venda" && oportunidadeAtiva && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Oportunidade de Pré-venda
                    </span>
                    <Chip tone="amber" className="text-[10px] capitalize">
                      {oportunidadeAtiva.etapa?.replace("_", " ")}
                    </Chip>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Empresa / Lead</p>
                    <p className="text-sm font-bold text-foreground">
                      {oportunidadeAtiva.empresa_nome || oportunidadeAtiva.nome_contato}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Valor Estimado</p>
                      <p className="font-extrabold text-emerald-600">
                        {oportunidadeAtiva.valor_mensal_estimado
                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                              oportunidadeAtiva.valor_mensal_estimado
                            )
                          : "–"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Próximo Contato</p>
                      <p className="font-medium text-foreground">
                        {oportunidadeAtiva.proximo_contato_em || "–"}
                      </p>
                    </div>
                  </div>
                  {oportunidadeAtiva.proximo_passo && (
                    <div className="pt-1 border-t border-amber-500/20">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Próximo Passo</p>
                      <p className="text-xs text-foreground mt-0.5">{oportunidadeAtiva.proximo_passo}</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 border-amber-300 dark:border-amber-800"
                    onClick={() => navigate("/pre-venda")}
                  >
                    Ver no Funil de Pré-venda
                  </Button>
                </div>
              )}

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
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">Cliente não vinculado.</p>
                  
                  <Button
                    className="w-full gap-2 bg-primary hover:bg-primary/90 shadow-sm font-bold"
                    onClick={() => setLinkCnpjOpen(true)}
                  >
                    <Link2 className="h-4 w-4" />
                    Vincular a Cliente
                  </Button>

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

          {showPanel === "arquivos" && (
            <AbaArquivos
              conversaId={conv.id}
              clienteId={customer?.id}
              clienteNome={customer?.name || conv.clientName}
              clienteCnpj={customer?.cnpj}
              clienteTelefone={conv.clientPhone}
              onVincularCliente={() => setLinkCnpjOpen(true)}
            />
          )}

          {showPanel === "members" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate max-w-[180px]">{subject}</h3>
                  <p className="text-xs text-muted-foreground">{size} integrantes</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={async () => {
                    if (conv?.clientPhone) {
                      try {
                        setLoadingGroupInfo(true);
                        const res = await fetchGroupInfo(conv.clientPhone);
                        if (res.success && res.data) {
                          setGroupInfo(res.data);
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setLoadingGroupInfo(false);
                      }
                    }
                  }} 
                  className="h-8 w-8 rounded-lg hover:bg-muted shrink-0 text-muted-foreground"
                  disabled={loadingGroupInfo}
                >
                  <Activity className={cn("w-4 h-4", loadingGroupInfo && "animate-spin")} />
                </Button>
              </div>

              {description && (
                <div className="p-3 bg-muted/30 rounded-xl border text-xs text-muted-foreground break-words">
                  <p className="font-bold text-[9px] uppercase text-muted-foreground/70 mb-1">Descrição</p>
                  {description}
                </div>
              )}

              <div className="relative">
                <Input 
                  placeholder="Pesquisar integrante..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="h-9 rounded-xl pr-8 text-xs bg-muted/20 border-border/40 focus-visible:ring-1"
                />
              </div>

              {loadingGroupInfo ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">Carregando integrantes...</p>
                </div>
              ) : filteredParticipants.length > 0 ? (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredParticipants.map((p: any) => {
                    if (!p) return null;
                    const jid = p.id || p.jid || "";
                    const isAdmin = p.admin === "admin" || p.admin === "superadmin" || p.admin === true;
                    const isOwner = p.id === groupInfo?.owner || p.jid === groupInfo?.owner || p.id === groupInfo?.data?.owner || p.jid === groupInfo?.data?.owner;
                    
                    return (
                      <div key={jid} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/10 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-primary/20">
                            {jid.split("@")[0].slice(-2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{formatJidToPhone(jid)}</p>
                            {(isAdmin || isOwner) && (
                              <span className="inline-block text-[8px] font-bold uppercase tracking-widest text-primary/80 mt-0.5">
                                {isOwner ? "Criador" : "Admin"}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleStartPrivateChat(jid)}
                          className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary shrink-0"
                          title="Enviar mensagem direta"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Nenhum integrante encontrado.
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
                    <p className="text-[9px] mt-1.5 opacity-50 font-mono">{formatDateTime(h.timestamp)}</p>
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
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 border border-primary/20 group-hover:scale-105 transition-transform relative overflow-hidden">
                        {c.clientAvatar && (
                          <img 
                            src={c.clientAvatar} 
                            className="absolute inset-0 w-full h-full rounded-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (c.clientAvatar?.includes('whatsapp.net') && !c.isGroup) {
                                fetch('/api/sync-avatar', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ conversationId: c.id })
                                }).then(r => r.json()).then(d => {
                                  if (d.ok && d.url) store.addDbConversation({ id: c.id, clientAvatar: d.url } as any);
                                }).catch(() => {});
                              }
                            }} 
                          />
                        )}
                        <span>{c.clientName?.charAt(0) || '?'}</span>
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

      {/* Custom AlertDialog for Delete Message confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-[24px] border border-border/40 bg-card/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Apagar Mensagem</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
              Deseja realmente apagar esta mensagem para todos? Esta ação também removerá a mensagem do WhatsApp do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl border border-border/40 font-semibold">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteMessage} 
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              Apagar para Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
