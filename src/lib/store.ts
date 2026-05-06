import { useState, useEffect } from "react";

// 1. Constantes e Tipos primeiro
export type UserRole = "admin" | "supervisor" | "atendente" | "recepcionista";
export type StatusFinanceiro = "Adimplente" | "Inadimplente" | "Atenção";

export const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "kanban-new" },
  pendente: { label: "Pendente", color: "kanban-waiting" },
  respondido: { label: "Respondido", color: "kanban-active" },
  resolvido: { label: "Resolvido", color: "kanban-resolved" },
};

export type StatusCliente = "Ativo" | "Onboarding" | "Inativo" | "Encerrado";
export type RegimeTributario = "MEI" | "Simples Nacional" | "Lucro Presumido" | "Lucro Real";
export type Prioridade = "Baixa" | "Média" | "Alta";
export type ConversationStatus = "novo" | "pendente" | "respondido" | "resolvido";
export type ClosingReason = "resolvido" | "aguardando_cliente" | "transferido" | "sem_resposta" | "outro";
export type MessageType = "text" | "image" | "audio" | "video" | "document" | "sticker";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  whatsapp?: string;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logo?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
}

export interface Customer {
  id: string;
  name: string;
  razaoSocial: string;
  cnpj: string;
  responsibleName: string;
  whatsapp: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  regime: RegimeTributario;
  naturezaJuridica: string;
  cnae: string;
  hasEmployees: boolean;
  employeeCount: number;
  status: StatusCliente;
  priority: Prioridade;
  serviceLevel: string;
  preferredChannel: string;
  plan: string;
  monthlyValue: number;
  origin: string;
  tenantId: string;
  contacts: any[];
  tags: string[];
  documents: any[];
  observations: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  clientName: string;
  clientPhone: string;
  customerId?: string;
  lastMessage: string;
  lastMessageTime: Date;
  status: ConversationStatus;
  assignedTo?: string;
  startedAt?: Date;
  slaDeadline?: Date;
  tenantId: string;
  tags: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: "client" | "agent";
  senderName: string;
  timestamp: Date;
  type?: MessageType;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
  status?: string;
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

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  lastUpdated: Date;
}

interface Store {
  users: User[];
  customers: Customer[];
  conversations: Conversation[];
  messages: Message[];
  history: HistoryEntry[];
  knowledge: KnowledgeItem[];
  tags: Tag[];
  quickReplies: QuickReply[];
  currentUser: User | null;
  currentTenantId: string | undefined;
  isIAChatOpen: boolean;
  
  // Actions
  setUsers: (users: User[]) => void;
  setCustomers: (customers: Customer[]) => void;
  addDbCustomer: (customer: Customer) => void;
  setConversations: (conversations: Conversation[]) => void;
  addDbConversation: (conv: Conversation) => void;
  addDbConversations: (convs: Conversation[]) => void;
  setMessages: (messages: Message[]) => void;
  addDbMessages: (msgs: Message[]) => void;
  addDbHistory: (entries: HistoryEntry[]) => void;
  setCurrentUser: (user: User | null) => void;
  setCurrentTenantId: (id: string | undefined) => void;
  setIAChatOpen: (open: boolean) => void;
  getSLAStatus: (conv: Conversation) => "ok" | "em_risco" | "estourado";
  getConversation: (id: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getNotes: (conversationId: string) => any[];
  getHistory: (conversationId: string) => HistoryEntry[];
  getCustomer: (id?: string) => Customer | undefined;
  assumeConversation: (conversationId: string, user: User) => void;
  transferConversation: (conversationId: string, fromUser: User, toUserId: string, reason?: string) => void;
  updateStatus: (conversationId: string, status: ConversationStatus, user: User, closingReason?: ClosingReason) => void;
  sendMessage: (conversationId: string, content: string, user: User, options?: Partial<Message>) => string;
  addNote: (conversationId: string, content: string, user: User) => void;
  addTag: (conversationId: string, tagId: string) => void;
  removeTag: (conversationId: string, tagId: string) => void;
}

// 2. Mocks (Vazios mas existentes)
export const MOCK_TAGS: Tag[] = [
  { id: "1", name: "Prioridade", color: "#EF4444" },
  { id: "2", name: "Dúvida", color: "#F59E0B" },
  { id: "3", name: "Financeiro", color: "#10B981" }
];

// 3. Estado interno e Listeners
const listeners = new Set<() => void>();

const store: Store = {
  users: [],
  customers: [],
  conversations: [],
  messages: [],
  history: [],
  knowledge: [],
  tags: MOCK_TAGS,
  quickReplies: [],
  currentUser: null,
  currentTenantId: undefined,
  isIAChatOpen: false,

  setUsers(users) {
    store.users = users;
    notify();
  },
  setCustomers(customers) {
    store.customers = customers;
    notify();
  },
  addDbCustomer(customer) {
    const exists = store.customers.find(c => c.id === customer.id);
    if (exists) {
      Object.assign(exists, customer);
    } else {
      store.customers = [...store.customers, customer];
    }
    notify();
  },
  setConversations(conversations) {
    store.conversations = conversations;
    notify();
  },
  addDbConversation(conv) {
    const index = store.conversations.findIndex(c => c.id === conv.id);
    if (index !== -1) {
      store.conversations[index] = { ...store.conversations[index], ...conv };
      store.conversations = [...store.conversations];
    } else {
      store.conversations = [conv, ...store.conversations];
    }
    notify();
  },
  addDbConversations(convs) {
    let updated = false;
    const newConvs = [...store.conversations];
    convs.forEach(conv => {
      const index = newConvs.findIndex(c => c.id === conv.id);
      if (index !== -1) {
        newConvs[index] = { ...newConvs[index], ...conv };
      } else {
        newConvs.unshift(conv);
      }
      updated = true;
    });
    if (updated) {
      store.conversations = newConvs;
      notify();
    }
  },
  setMessages(messages) {
    store.messages = messages;
    notify();
  },
  addDbMessages(msgs) {
    let updated = false;
    const newMsgs = [...store.messages];
    msgs.forEach(msg => {
      if (!newMsgs.find(m => m.id === msg.id)) {
        newMsgs.push(msg);
        updated = true;
      }
    });
    if (updated) {
      store.messages = newMsgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      notify();
    }
  },
  addDbHistory(entries) {
    let updated = false;
    const newHistory = [...store.history];
    entries.forEach(e => {
      if (!newHistory.find(h => h.id === e.id)) {
        newHistory.push(e);
        updated = true;
      }
    });
    if (updated) {
      store.history = newHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      notify();
    }
  },
  setCurrentUser(user) {
    store.currentUser = user;
    if (user?.tenantId) {
      store.currentTenantId = user.tenantId;
    }
    notify();
  },
  setCurrentTenantId(id) {
    store.currentTenantId = id;
    notify();
  },
  setIAChatOpen(open) {
    store.isIAChatOpen = open;
    notify();
  },
  getSLAStatus(conv) {
    if (conv.status === "resolvido" || conv.status === "respondido") return "ok";
    if (!conv.slaDeadline) return "ok";
    const now = new Date();
    const deadline = new Date(conv.slaDeadline);
    if (now > deadline) return "estourado";
    const diff = deadline.getTime() - now.getTime();
    if (diff < 1000 * 60 * 30) return "em_risco"; // 30 min
    return "ok";
  },
  getConversation(id) {
    return store.conversations.find(c => c.id === id);
  },
  getMessages(conversationId) {
    return store.messages.filter(m => m.conversationId === conversationId);
  },
  getNotes(conversationId) {
    return []; // Notas agora são carregadas sob demanda ou via mensagens internas
  },
  getHistory(conversationId) {
    return store.history.filter(h => h.conversationId === conversationId);
  },
  getCustomer(id) {
    return store.customers.find(c => c.id === id);
  },
  assumeConversation(conversationId, user) {
    store.addDbConversation({ id: conversationId, assignedTo: user.id, status: "respondido" } as any);
  },
  transferConversation(conversationId, fromUser, toUserId, reason) {
    store.addDbConversation({ id: conversationId, assignedTo: toUserId } as any);
  },
  updateStatus(conversationId, status, user, closingReason) {
    store.addDbConversation({ id: conversationId, status } as any);
  },
  sendMessage(conversationId, content, user, options) {
    const id = `temp-${Date.now()}`;
    store.addDbMessages([{
      id,
      conversationId,
      content,
      sender: "agent",
      senderName: user.name,
      timestamp: new Date(),
      ...options
    }]);
    return id;
  },
  addNote(conversationId, content, user) {
    // Implementar se necessário
  },
  addTag(conversationId, tagId) {
    const conv = store.getConversation(conversationId);
    if (conv && !conv.tags.includes(tagId)) {
      store.addDbConversation({ id: conversationId, tags: [...conv.tags, tagId] } as any);
    }
  },
  removeTag(conversationId, tagId) {
    const conv = store.getConversation(conversationId);
    if (conv) {
      store.addDbConversation({ id: conversationId, tags: conv.tags.filter(t => t !== tagId) } as any);
    }
  }
};

function notify() {
  listeners.forEach(l => {
    try {
      l();
    } catch (e) {
      console.error("Store notification error:", e);
    }
  });
}

// 4. Exportar Hooks e Helpers
export const useStore = () => {
  const [state, setState] = useState(store);
  useEffect(() => {
    const listener = () => setState({ ...store });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
};

export const setCurrentTenantId = (id: string | undefined) => {
  store.setCurrentTenantId(id);
};

export function formatRelativeTime(date: Date): string {
  if (!date) return "...";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (isNaN(diff)) return "...";
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days === 1) return "ontem";
  return `${days}d atrás`;
}

export function formatTime(date: Date): string {
  if (!date || isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(start: Date): string {
  if (!start || isNaN(start.getTime())) return "0m";
  const diff = Date.now() - start.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function ensureDate(date: any): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date() : d;
}
