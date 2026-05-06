import { useState, useCallback, useEffect } from "react";

// Types
export type UserRole = "admin" | "supervisor" | "atendente" | "recepcionista";
export type ConversationStatus = "novo" | "aguardando_aceite" | "em_atendimento" | "aguardando_cliente" | "resolvido";
export type SLAStatus = "dentro_do_prazo" | "em_risco" | "estourado";
export type ClosingReason = "resolvido" | "aguardando_cliente" | "transferido" | "sem_resposta" | "outro";

export type RegimeTributario = "MEI" | "Simples Nacional" | "Lucro Presumido" | "Lucro Real";
export type StatusCliente = "Ativo" | "Onboarding" | "Inativo" | "Encerrado";
export type Prioridade = "Baixa" | "Média" | "Alta";
export type NivelAtendimento = "Padrão" | "Premium" | "Estratégico";
export type CanalPreferencial = "WhatsApp" | "Email" | "Telefone";
export type StatusFinanceiro = "Adimplente" | "Inadimplente" | "Atenção";
export type TipoContato = "Financeiro" | "RH" | "Fiscal" | "Societário" | "Outro";

export interface Tenant {
  id: string;
  name: string;
  logo?: string;
  subdomain: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  tenantId: string;
  whatsapp?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type MessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: "client" | "agent";
  senderName: string;
  timestamp: Date;
  isInternal?: boolean;
  type?: MessageType;
  mediaUrl?: string;
  mediaStoragePath?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  durationSeconds?: number;
  waveformData?: any;
  status?: MessageStatus;
  externalMessageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  tenantId?: string;
}

export type ScheduledMessageStatus = 'agendada' | 'enviada' | 'erro' | 'cancelada';

export interface ScheduledMessage {
  id: string;
  tenantId: string;
  clienteId?: string;
  conversaId?: string;
  receiverNumber: string;
  messageType: MessageType;
  textContent?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  scheduledAt: Date;
  status: ScheduledMessageStatus;
  createdBy?: string;
  sentAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalNote {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: Date;
}

export interface HistoryEntry {
  id: string;
  conversationId?: string;
  customerId?: string;
  action: string;
  userId?: string;
  userName?: string;
  details?: string;
  timestamp: Date;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
  type: TipoContato;
}

export interface CustomerDocument {
  id: string;
  name: string;
  type: string;
  expiryDate?: Date;
  url: string;
}

export interface Customer {
  id: string;
  razaoSocial: string;
  name: string; // Fantasia
  cnpj: string;
  responsibleName: string;
  whatsapp: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  
  // Contábeis
  regime: RegimeTributario;
  naturezaJuridica: string;
  cnae: string;
  openingDate?: Date;
  hasEmployees: boolean;
  employeeCount: number;
  
  // Atendimento
  consultantId?: string;
  attendantId?: string;
  supervisorId?: string;
  status: StatusCliente;
  priority: Prioridade;
  serviceLevel: NivelAtendimento;
  preferredChannel: CanalPreferencial;
  preferredTime?: string;
  
  // Comercial
  plan: string;
  monthlyValue: number;
  startDate?: Date;
  financialStatus: StatusFinanceiro;
  origin: string;
  
  // Outros
  contacts: Contact[];
  observations: string;
  tags: string[];
  documents: CustomerDocument[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  clientName: string;
  clientPhone: string;
  customerId?: string; // Link to customer
  lastMessage: string;
  lastMessageTime: Date;
  status: ConversationStatus;
  assignedTo?: string;
  assignedToName?: string;
  tags: string[];
  startedAt?: Date;
  slaDeadline?: Date;
  closingReason?: ClosingReason;
  tenantId?: string;
}

export interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
}

// Production-ready initial state (Empty)
export const MOCK_TENANTS: Tenant[] = [];
export const MOCK_USERS: User[] = [];
export const MOCK_TAGS: Tag[] = [];
export const MOCK_QUICK_REPLIES: QuickReply[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_CONVERSATIONS: Conversation[] = [];
const INITIAL_MESSAGES: Message[] = [];
const INITIAL_HISTORY: HistoryEntry[] = [];

// Store state - singleton for in-memory storage
let globalConversations = [...INITIAL_CONVERSATIONS];
let globalMessages = [...INITIAL_MESSAGES];
let globalNotes: InternalNote[] = [];
let globalHistory = [...INITIAL_HISTORY];
let globalCustomers = [...INITIAL_CUSTOMERS];
let globalUsers = [...MOCK_USERS];
let globalCurrentUser: User | null = null;
let globalIAChatOpen = false;
let globalTags: Tag[] = [];
let globalQuickReplies: QuickReply[] = [];
let globalScheduledMessages: ScheduledMessage[] = [];
let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((l) => l());
}

// Store hook - accepts optional tenantId for multi-tenant filtering
// For internal use - when you need to pass tenantId explicitly
export function useStoreInternal(tenantId?: string) {
  const [, setTick] = useState(0);

  const subscribe = useCallback(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    return subscribe();
  }, [subscribe]);

  // Filter data by tenant if tenantId is provided
  const filterByTenant = <T extends { tenantId?: string }>(items: T[]): T[] => {
    if (!tenantId) return items;
    return items.filter((item) => !item.tenantId || item.tenantId === tenantId);
  };

  // Filter users by tenant
  const filteredUsers = filterByTenant(MOCK_USERS);

  return {
    conversations: globalConversations,
    messages: globalMessages,
    notes: globalNotes,
    history: globalHistory,
    customers: globalCustomers,
    users: globalUsers,
    tags: globalTags,
    quickReplies: globalQuickReplies,
    scheduledMessages: globalScheduledMessages,
    isIAChatOpen: globalIAChatOpen,
    setIAChatOpen: (open: boolean) => {
      globalIAChatOpen = open;
      notify();
    },
    currentUser: globalCurrentUser,
    setCurrentUser: (user: User | null) => {
      globalCurrentUser = user;
      notify();
    },

    getConversation: (id: string) => globalConversations.find((c) => c.id === id),
    getCustomer: (id?: string) => globalCustomers.find((c) => c.id === id),
    getCustomerByCnpj: (cnpj: string) => globalCustomers.find((c) => c.cnpj === cnpj),
    getCustomerByPhone: (phone: string) => globalCustomers.find((c) => c.whatsapp === phone || c.phone === phone),

    getMessages: (conversationId: string) =>
      globalMessages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),

    getNotes: (conversationId: string) =>
      globalNotes.filter((n) => n.conversationId === conversationId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),

    getHistory: (conversationId?: string, customerId?: string) =>
      globalHistory.filter((h) => 
        (conversationId && h.conversationId === conversationId) || 
        (customerId && h.customerId === customerId)
      ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),

    getScheduledMessages: (conversaId?: string) => 
      globalScheduledMessages.filter(m => !conversaId || m.conversaId === conversaId),

    assumeConversation: (conversationId: string, user: User) => {
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId
          ? { ...c, assignedTo: user.id, assignedToName: user.name, status: "em_atendimento" as ConversationStatus, startedAt: new Date() }
          : c
      );
      globalHistory = [
        ...globalHistory,
        { id: `h${Date.now()}`, conversationId, action: "Conversa assumida", userId: user.id, userName: user.name, timestamp: new Date() },
      ];
      notify();
    },

    transferConversation: (conversationId: string, fromUser: User, toUserId: string, reason?: string) => {
      const toUser = globalUsers.find((u) => u.id === toUserId);
      if (!toUser) return;
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId
          ? { ...c, assignedTo: toUser.id, assignedToName: toUser.name }
          : c
      );
      
      // Também precisamos atualizar as mensagens vinculadas se houver alguma lógica de filtragem, 
      // mas as mensagens são buscadas por conversationId, então devem permanecer.
      globalHistory = [
        ...globalHistory,
        {
          id: `h${Date.now()}`,
          conversationId,
          action: `Transferida de ${fromUser.name} para ${toUser.name}`,
          userId: fromUser.id,
          userName: fromUser.name,
          details: reason || undefined,
          timestamp: new Date(),
        },
      ];
      notify();
    },

    updateStatus: (conversationId: string, status: ConversationStatus, user: User, closingReason?: ClosingReason) => {
      const statusLabels: Record<ConversationStatus, string> = {
        novo: "Novo",
        aguardando_aceite: "Aguardando aceite",
        em_atendimento: "Em atendimento",
        aguardando_cliente: "Aguardando cliente",
        resolvido: "Resolvido",
      };
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId
          ? { ...c, status, closingReason: closingReason || c.closingReason }
          : c
      );
      globalHistory = [
        ...globalHistory,
        {
          id: `h${Date.now()}`,
          conversationId,
          action: `Status alterado para ${statusLabels[status]}`,
          userId: user.id,
          userName: user.name,
          details: closingReason ? `Motivo: ${closingReason}` : undefined,
          timestamp: new Date(),
        },
      ];
      notify();
    },

    sendMessage: (conversationId: string, content: string, user: User, options?: Partial<Message>) => {
      const msg: Message = {
        id: `m${Date.now()}`,
        conversationId,
        content,
        sender: "agent",
        senderName: user.name,
        timestamp: new Date(),
        status: 'sending',
        type: 'text',
        ...options
      };
      globalMessages = [...globalMessages, msg];
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: content, lastMessageTime: new Date() } : c
      );
      notify();
      return msg.id;
    },

    addNote: (conversationId: string, content: string, user: User) => {
      const note: InternalNote = {
        id: `n${Date.now()}`,
        conversationId,
        authorId: user.id,
        authorName: user.name,
        content,
        timestamp: new Date(),
      };
      globalNotes = [...globalNotes, note];
      notify();
    },

    addTag: (conversationId: string, tagId: string) => {
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId && !c.tags.includes(tagId) ? { ...c, tags: [...c.tags, tagId] } : c
      );
      notify();
    },

    removeTag: (conversationId: string, tagId: string) => {
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId ? { ...c, tags: c.tags.filter((t) => t !== tagId) } : c
      );
      notify();
    },

    getSLAStatus: (conversation: Conversation): SLAStatus => {
      const deadline = ensureDate(conversation.slaDeadline);
      if (!deadline) return "dentro_do_prazo";
      const remaining = deadline.getTime() - Date.now();
      if (remaining <= 0) return "estourado";
      if (remaining <= 10 * 60000) return "em_risco";
      return "dentro_do_prazo";
    },

    addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => {
      const newCustomer: Customer = {
        ...customer,
        id: `cus${Date.now()}`,
        createdAt: new Date(),
      };
      globalCustomers = [newCustomer, ...globalCustomers];
      globalHistory = [
        ...globalHistory,
        { id: `h${Date.now()}`, customerId: newCustomer.id, action: "Cadastro de cliente criado", timestamp: new Date() }
      ];
      notify();
      return newCustomer;
    },

    updateCustomer: (id: string, customer: Partial<Customer>) => {
      globalCustomers = globalCustomers.map((c) =>
        c.id === id ? { ...c, ...customer } : c
      );
      globalHistory = [
        ...globalHistory,
        { id: `h${Date.now()}`, customerId: id, action: "Cadastro de cliente atualizado", timestamp: new Date() }
      ];
      notify();
    },

    updateCustomerStatus: (customerId: string, status: StatusCliente) => {
      globalCustomers = globalCustomers.map((c) =>
        c.id === customerId ? { ...c, status } : c
      );
      globalHistory = [
        ...globalHistory,
        { id: `h${Date.now()}`, customerId: customerId, action: `Status alterado para ${status}`, timestamp: new Date() }
      ];
      notify();
    },

    autoCreateCustomer: (name: string, phone: string) => {
      const existing = globalCustomers.find(c => c.whatsapp === phone || c.phone === phone);
      if (existing) return existing.id;

      const newCustomer: Customer = {
        id: `cus${Date.now()}`,
        razaoSocial: name,
        name: name,
        cnpj: `MOCK-${Date.now()}`,
        responsibleName: name,
        whatsapp: phone,
        phone: phone,
        email: "",
        city: "",
        state: "",
        regime: "Simples Nacional",
        naturezaJuridica: "",
        cnae: "",
        hasEmployees: false,
        employeeCount: 0,
        status: "Onboarding",
        priority: "Média",
        serviceLevel: "Padrão",
        preferredChannel: "WhatsApp",
        plan: "Pendente",
        monthlyValue: 0,
        financialStatus: "Atenção",
        origin: "WhatsApp Automático",
        contacts: [],
        observations: "Criado automaticamente via WhatsApp",
        tags: [],
        documents: [],
        createdAt: new Date(),
      };
      globalCustomers = [newCustomer, ...globalCustomers];
      notify();
      return newCustomer.id;
    },

    // New: Functions to add DB loaded data to store
    addDbConversation: (conv: Conversation) => {
      const existingIdx = globalConversations.findIndex(c => c.id === conv.id);
      if (existingIdx === -1) {
        globalConversations = [conv, ...globalConversations];
        notify();
      } else {
        const existing = globalConversations[existingIdx];
        if (existing.assignedTo !== conv.assignedTo || existing.status !== conv.status || existing.lastMessage !== conv.lastMessage) {
          globalConversations = globalConversations.map(c => c.id === conv.id ? { ...c, ...conv } : c);
          notify();
        }
      }
    },
    addDbConversations: (convs: Conversation[]) => {
      let hasChanges = false;
      const currentConversations = [...globalConversations];

      convs.forEach(dbConv => {
        const idx = currentConversations.findIndex(c => c.id === dbConv.id);
        if (idx === -1) {
          currentConversations.push(dbConv);
          hasChanges = true;
        } else {
          const existing = currentConversations[idx];
          if (existing.assignedTo !== dbConv.assignedTo || existing.status !== dbConv.status || existing.lastMessage !== dbConv.lastMessage) {
            currentConversations[idx] = { ...existing, ...dbConv };
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        globalConversations = currentConversations;
        notify();
      }
    },
    addDbMessages: (msgs: Message[]) => {
      let hasChanges = false;
      const currentMessages = [...globalMessages];

      msgs.forEach(dbMsg => {
        // 1. Skip if ID already exists
        if (currentMessages.find(m => m.id === dbMsg.id)) return;

        // 2. Look for matching optimistic message
        // An optimistic message has an ID starting with 'm' (see sendMessage)
        const optimisticIdx = currentMessages.findIndex(m => 
          m.id.startsWith('m') && 
          m.conversationId === dbMsg.conversationId &&
          m.content === dbMsg.content &&
          m.sender === dbMsg.sender &&
          Math.abs(m.timestamp.getTime() - dbMsg.timestamp.getTime()) < 45000 // 45s window
        );

        if (optimisticIdx !== -1) {
          // Replace optimistic message with real database message
          currentMessages[optimisticIdx] = dbMsg;
          hasChanges = true;
        } else {
          // Add as new message
          currentMessages.push(dbMsg);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        globalMessages = currentMessages;
        notify();
      }
    },
    addDbScheduledMessages: (msgs: ScheduledMessage[]) => {
      const newMsgs = msgs.filter(m => !globalScheduledMessages.find(gm => gm.id === m.id));
      if (newMsgs.length > 0) {
        globalScheduledMessages = [...globalScheduledMessages, ...newMsgs];
        notify();
      }
    },
    addDbHistory: (entries: HistoryEntry[]) => {
      const newEntries = entries.filter(e => !globalHistory.find(ge => ge.id === e.id));
      if (newEntries.length > 0) {
        globalHistory = [...globalHistory, ...newEntries];
        notify();
      }
    },
    updateScheduledMessage: (id: string, updates: Partial<ScheduledMessage>) => {
      globalScheduledMessages = globalScheduledMessages.map(m => m.id === id ? { ...m, ...updates } : m);
      notify();
    },
    setGlobalUsers: (users: User[]) => {
      globalUsers = users;
      notify();
    },
    updateStoreUser: (id: string, updates: Partial<User>) => {
      globalUsers = globalUsers.map(u => u.id === id ? { ...u, ...updates } : u);
      notify();
    },
    setGlobalTags: (tags: Tag[]) => {
      globalTags = tags;
      notify();
    },
    setGlobalQuickReplies: (qrs: QuickReply[]) => {
      globalQuickReplies = qrs;
      notify();
    },
    setUsers: (users: User[]) => {
      globalUsers = users;
      notify();
    },
    addDbCustomer: (customer: Customer) => {
      const existingIdx = globalCustomers.findIndex(c => c.id === customer.id);
      if (existingIdx === -1) {
        globalCustomers = [customer, ...globalCustomers];
        notify();
      } else {
        const existing = globalCustomers[existingIdx];
        // Atualizar se houve mudança ou se campos críticos estão vazios
        if (existing.name !== customer.name || existing.status !== customer.status || existing.cnpj !== customer.cnpj) {
          globalCustomers = globalCustomers.map(c => c.id === customer.id ? { ...c, ...customer } : c);
          notify();
        }
      }
    }
  };
}


// Helpers
export function ensureDate(date: any): Date | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatDuration(start: Date): string {
  const diff = Date.now() - start.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "kanban-new" },
  aguardando_aceite: { label: "Aguardando aceite", color: "kanban-waiting" },
  em_atendimento: { label: "Em atendimento", color: "kanban-active" },
  aguardando_cliente: { label: "Aguardando cliente", color: "kanban-client" },
  resolvido: { label: "Resolvido", color: "kanban-resolved" },
};

const currentTenantIdCtx = {
  id: undefined as string | undefined,
  set(id: string | undefined) {
    this.id = id;
  },
  get() {
    return this.id;
  },
};

let tenantIdSetter: ((id: string) => void) | null = null;

export function registerTenantIdSetter(setter: (id: string) => void) {
  tenantIdSetter = setter;
  if (currentTenantIdCtx.id) {
    setter(currentTenantIdCtx.id);
  }
}

export function setCurrentTenantId(id: string | undefined) {
  currentTenantIdCtx.set(id);
  if (tenantIdSetter && id) {
    tenantIdSetter(id);
  }
}

export function useStore(...args: Parameters<typeof useStoreInternal>) {
  const tenantId = currentTenantIdCtx.get();
  return useStoreInternal(tenantId ?? args[0]);
}
