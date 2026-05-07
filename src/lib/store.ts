import { useState, useEffect } from "react";

// 1. Tipos e Interfaces (Sem mudanças)
export type UserRole = "admin" | "supervisor" | "atendente" | "recepcionista";
export type StatusFinanceiro = "Adimplente" | "Inadimplente" | "Atenção";
export type StatusCliente = "Ativo" | "Onboarding" | "Inativo" | "Encerrado";
export type RegimeTributario = "MEI" | "Simples Nacional" | "Lucro Presumido" | "Lucro Real";
export type Prioridade = "Baixa" | "Média" | "Alta";
export type ConversationStatus = "novo" | "pendente" | "respondido" | "resolvido" | "aguardando_aceite" | "em_atendimento" | "aguardando_cliente";
export type SLAStatus = "ok" | "em_risco" | "estourado";
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

// 2. Configurações Globais
export const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "kanban-new" },
  pendente: { label: "Pendente", color: "kanban-waiting" },
  respondido: { label: "Respondido", color: "kanban-active" },
  resolvido: { label: "Resolvido", color: "kanban-resolved" },
  aguardando_aceite: { label: "Aguardando Aceite", color: "bg-yellow-500" },
  em_atendimento: { label: "Em Atendimento", color: "bg-primary" },
  aguardando_cliente: { label: "Aguardando Cliente", color: "bg-purple-500" },
};

export const MOCK_TAGS: Tag[] = [
  { id: "1", name: "Prioridade", color: "#EF4444" },
  { id: "2", name: "Dúvida", color: "#F59E0B" },
  { id: "3", name: "Financeiro", color: "#10B981" }
];

// 3. Inicialização Lazy do Store
let globalStore: Store | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => {
    try { l(); } catch (e) { console.error(e); }
  });
}

function getStore(): Store {
  if (!globalStore) {
    const s: Store = {
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

      setUsers(users) { s.users = users; notify(); },
      setCustomers(customers) { s.customers = customers; notify(); },
      addDbCustomer(customer) {
        const exists = s.customers.find(c => c.id === customer.id);
        if (exists) Object.assign(exists, customer);
        else s.customers = [...s.customers, customer];
        notify();
      },
      setConversations(conversations) { s.conversations = conversations; notify(); },
      addDbConversation(conv) {
        const index = s.conversations.findIndex(c => c.id === conv.id);
        if (index !== -1) {
          s.conversations[index] = { ...s.conversations[index], ...conv };
          s.conversations = [...s.conversations];
        } else {
          s.conversations = [conv, ...s.conversations];
        }
        notify();
      },
      addDbConversations(convs) {
        let updated = false;
        const newConvs = [...s.conversations];
        convs.forEach(conv => {
          const index = newConvs.findIndex(c => c.id === conv.id);
          if (index !== -1) newConvs[index] = { ...newConvs[index], ...conv };
          else newConvs.unshift(conv);
          updated = true;
        });
        if (updated) { s.conversations = newConvs; notify(); }
      },
      setMessages(messages) { s.messages = messages; notify(); },
      addDbMessages(msgs) {
        let updated = false;
        const newMsgs = [...s.messages];
        msgs.forEach(msg => {
          if (!newMsgs.find(m => m.id === msg.id)) { newMsgs.push(msg); updated = true; }
        });
        if (updated) { 
          s.messages = newMsgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          notify(); 
        }
      },
      addDbHistory(entries) {
        let updated = false;
        const newHistory = [...s.history];
        entries.forEach(e => {
          if (!newHistory.find(h => h.id === e.id)) { newHistory.push(e); updated = true; }
        });
        if (updated) {
          s.history = newHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          notify();
        }
      },
      setCurrentUser(user) {
        s.currentUser = user;
        if (user?.tenantId) s.currentTenantId = user.tenantId;
        notify();
      },
      setCurrentTenantId(id) { s.currentTenantId = id; notify(); },
      setIAChatOpen(open) { s.isIAChatOpen = open; notify(); },
      getSLAStatus(conv) {
        if (conv.status === "resolvido" || conv.status === "respondido") return "ok";
        if (!conv.slaDeadline) return "ok";
        const now = new Date();
        const deadline = new Date(conv.slaDeadline);
        if (now > deadline) return "estourado";
        const diff = deadline.getTime() - now.getTime();
        return diff < 1000 * 60 * 30 ? "em_risco" : "ok";
      },
      getConversation: (id) => s.conversations.find(c => c.id === id),
      getMessages: (conversationId) => s.messages.filter(m => m.conversationId === conversationId),
      getNotes: () => [],
      getHistory: (conversationId) => s.history.filter(h => h.conversationId === conversationId),
      getCustomer: (id) => s.customers.find(c => c.id === id),
      assumeConversation(conversationId, user) {
        s.addDbConversation({ id: conversationId, assignedTo: user.id, status: "respondido" } as any);
      },
      transferConversation(conversationId, fromUser, toUserId) {
        s.addDbConversation({ id: conversationId, assignedTo: toUserId } as any);
      },
      updateStatus(conversationId, status) {
        s.addDbConversation({ id: conversationId, status } as any);
      },
      sendMessage(conversationId, content, user, options) {
        const id = `temp-${Date.now()}`;
        s.addDbMessages([{
          id, conversationId, content, sender: "agent", senderName: user.name, timestamp: new Date(), ...options
        }]);
        return id;
      },
      addNote: () => {},
      addTag(conversationId, tagId) {
        const conv = s.getConversation(conversationId);
        if (conv && !conv.tags.includes(tagId)) {
          s.addDbConversation({ id: conversationId, tags: [...conv.tags, tagId] } as any);
        }
      },
      removeTag(conversationId, tagId) {
        const conv = s.getConversation(conversationId);
        if (conv) {
          s.addDbConversation({ id: conversationId, tags: conv.tags.filter(t => t !== tagId) } as any);
        }
      }
    };
    globalStore = s;
  }
  return globalStore;
}

// 4. Hooks e Helpers Exportados
export function useStore() {
  const [state, setState] = useState(() => getStore());
  useEffect(() => {
    const listener = () => setState({ ...getStore() });
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return state;
}

export function setCurrentTenantId(id: string | undefined) {
  getStore().setCurrentTenantId(id);
}

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
