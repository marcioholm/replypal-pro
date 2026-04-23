import { useState, useCallback, useEffect } from "react";

// Types
export type UserRole = "admin" | "supervisor" | "atendente";
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

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: "client" | "agent";
  senderName: string;
  timestamp: Date;
  isInternal?: boolean;
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
}

export interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
}

// Mock Data
export const MOCK_TENANTS: Tenant[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sasaki Contabilidade", subdomain: "sasaki" },
  { id: "tenant2", name: "Empresa Beta", subdomain: "beta" },
];

export const MOCK_USERS: User[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Carlos Silva", email: "carlos@sasaki.com", role: "admin", tenantId: "11111111-1111-1111-1111-111111111111" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Ana Souza", email: "ana@empresa.com", role: "supervisor", tenantId: "11111111-1111-1111-1111-111111111111" },
  { id: "33333333-3333-3333-3333-333333333333", name: "João Santos", email: "joao@empresa.com", role: "atendente", tenantId: "11111111-1111-1111-1111-111111111111" },
  { id: "u4", name: "Maria Oliveira", email: "maria@empresa.com", role: "atendente", tenantId: "11111111-1111-1111-1111-111111111111" },
  { id: "u5", name: "Pedro Costa", email: "pedro@empresa.com", role: "atendente", tenantId: "11111111-1111-1111-1111-111111111111" },
  { id: "u6", name: "Bruno Lima", email: "bruno@empresa.com", role: "admin", tenantId: "11111111-1111-1111-1111-111111111111" },
  { id: "u7", name: "Carla Dias", email: "carla@empresa.com", role: "atendente", tenantId: "11111111-1111-1111-1111-111111111111" },
];

export const MOCK_TAGS: Tag[] = [
  { id: "t1", name: "Fiscal", color: "hsl(217, 91%, 60%)" },
  { id: "t2", name: "RH", color: "hsl(262, 83%, 58%)" },
  { id: "t3", name: "Urgente", color: "hsl(0, 72%, 51%)" },
  { id: "t4", name: "Financeiro", color: "hsl(38, 92%, 50%)" },
  { id: "t5", name: "Suporte", color: "hsl(160, 84%, 39%)" },
  { id: "t6", name: "Premium", color: "hsl(47, 95%, 50%)" },
  { id: "t7", name: "Inadimplente", color: "hsl(0, 0%, 20%)" },
];

export const MOCK_QUICK_REPLIES: QuickReply[] = [
  { id: "qr1", shortcut: "/fiscal", content: "Para questões fiscais, por favor envie seu CNPJ e o período de referência." },
  { id: "qr2", shortcut: "/documento", content: "Por favor, envie o documento solicitado em formato PDF." },
  { id: "qr3", shortcut: "/aguarde", content: "Estamos analisando sua solicitação. Retornaremos em breve." },
  { id: "qr4", shortcut: "/horario", content: "Nosso horário de atendimento é de segunda a sexta, das 8h às 18h." },
];

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000);

export const INITIAL_CUSTOMERS: Customer[] = [
  { 
    id: "cus1", 
    razaoSocial: "Roberto Almeida Serviços ME", 
    name: "Roberto Almeida", 
    cnpj: "12.345.678/0001-90",
    responsibleName: "Roberto Almeida",
    whatsapp: "+5511999001001",
    phone: "+551133334444",
    email: "roberto@gmail.com",
    city: "São Paulo",
    state: "SP",
    regime: "Simples Nacional",
    naturezaJuridica: "Sociedade Limitada",
    cnae: "6201-5/00",
    openingDate: new Date(2020, 3, 15), // April 15 (Foundation)
    hasEmployees: true,
    employeeCount: 3,
    consultantId: "u2",
    attendantId: "u3",
    status: "Ativo",
    priority: "Alta",
    serviceLevel: "Premium",
    preferredChannel: "WhatsApp",
    plan: "Contabilidade Express",
    monthlyValue: 450,
    startDate: new Date(2020, 1, 1),
    financialStatus: "Adimplente",
    origin: "Indicação",
    contacts: [
      { id: "ct1", name: "Marcos Silva", role: "Financeiro", phone: "+5511999991111", whatsapp: "+5511999991111", email: "financeiro@roberto.com", type: "Financeiro" }
    ],
    observations: "Cliente prefere contato via WhatsApp. Evitar ligações à tarde.",
    tags: ["t1", "t6"],
    documents: [],
    createdAt: minutesAgo(1000) 
  },
  { 
    id: "cus2", 
    razaoSocial: "Fernanda Lima Design LTDA", 
    name: "Fernanda Design", 
    cnpj: "98.765.432/0001-10",
    responsibleName: "Fernanda Lima",
    whatsapp: "+5511999001002",
    phone: "+551133445566",
    email: "fernanda@uol.com.br",
    city: "Rio de Janeiro",
    state: "RJ",
    regime: "Lucro Presumido",
    naturezaJuridica: "EIRELI",
    cnae: "7410-2/03",
    openingDate: new Date(2021, 2, 10),
    hasEmployees: false,
    employeeCount: 0,
    attendantId: "u3",
    status: "Ativo",
    priority: "Média",
    serviceLevel: "Padrão",
    preferredChannel: "Email",
    plan: "Contabilidade Base",
    monthlyValue: 300,
    startDate: new Date(2021, 3, 10), // April 10 (Service Anniversary - Today!)
    financialStatus: "Adimplente",
    origin: "Instagram",
    contacts: [],
    observations: "Sempre envia os documentos no prazo.",
    tags: ["t2"],
    documents: [],
    createdAt: minutesAgo(500) 
  },
  {
    id: "cus3",
    razaoSocial: "Martins & Associados Engenharia",
    name: "Lucas Martins",
    cnpj: "11.222.333/0001-44",
    responsibleName: "Lucas Martins",
    whatsapp: "+5511999001003",
    phone: "+551144445555",
    email: "lucas.m@outlook.com",
    city: "Belo Horizonte",
    state: "MG",
    regime: "Lucro Real",
    naturezaJuridica: "Sociedade Anônima",
    cnae: "7112-8/00",
    hasEmployees: true,
    employeeCount: 15,
    status: "Inativo",
    priority: "Baixa",
    serviceLevel: "Estratégico",
    preferredChannel: "Telefone",
    plan: "Contabilidade Full",
    monthlyValue: 1200,
    financialStatus: "Inadimplente",
    origin: "Google Ads",
    contacts: [],
    observations: "Dificuldade constante em enviar documentação fiscal.",
    tags: ["t7"],
    documents: [],
    createdAt: minutesAgo(2000)
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  { id: "c1", clientName: "Roberto Almeida", clientPhone: "+5511999001001", customerId: "cus1", lastMessage: "Preciso de ajuda com a nota fiscal", lastMessageTime: minutesAgo(2), status: "novo", tags: ["t1"], slaDeadline: new Date(now.getTime() + 30 * 60000) },
  { id: "c2", clientName: "Fernanda Lima", clientPhone: "+5511999001002", customerId: "cus2", lastMessage: "Qual o status do meu processo?", lastMessageTime: minutesAgo(5), status: "em_atendimento", assignedTo: "u3", assignedToName: "João Santos", tags: ["t2"], startedAt: minutesAgo(15), slaDeadline: new Date(now.getTime() + 15 * 60000) },
  { id: "c3", clientName: "Lucas Martins", clientPhone: "+5511999001003", customerId: "cus3", lastMessage: "Obrigado pela informação", lastMessageTime: minutesAgo(30), status: "aguardando_cliente", assignedTo: "u4", assignedToName: "Maria Oliveira", tags: ["t4"], startedAt: minutesAgo(60), slaDeadline: new Date(now.getTime() - 5 * 60000) },
  { id: "c4", clientName: "Patricia Ramos", clientPhone: "+5511999001004", lastMessage: "Urgente! Preciso resolver hoje", lastMessageTime: minutesAgo(1), status: "novo", tags: ["t3", "t1"], slaDeadline: new Date(now.getTime() + 10 * 60000) },
  { id: "c5", clientName: "Marcos Pereira", clientPhone: "+5511999001005", lastMessage: "Tudo resolvido, obrigado!", lastMessageTime: minutesAgo(120), status: "resolvido", assignedTo: "u3", assignedToName: "João Santos", tags: ["t5"], startedAt: minutesAgo(180), closingReason: "resolvido" },
  { id: "c6", clientName: "Camila Dias", clientPhone: "+5511999001006", lastMessage: "Boa tarde, preciso de suporte", lastMessageTime: minutesAgo(8), status: "aguardando_aceite", tags: ["t5"], slaDeadline: new Date(now.getTime() + 25 * 60000) },
  { id: "c7", clientName: "André Barbosa", clientPhone: "+5511999001007", lastMessage: "Podem me enviar o boleto?", lastMessageTime: minutesAgo(45), status: "em_atendimento", assignedTo: "u5", assignedToName: "Pedro Costa", tags: ["t4"], startedAt: minutesAgo(50), slaDeadline: new Date(now.getTime() + 5 * 60000) },
  { id: "c8", clientName: "Juliana Torres", clientPhone: "+5511999001008", lastMessage: "Estou aguardando retorno", lastMessageTime: minutesAgo(90), status: "aguardando_cliente", assignedTo: "u3", assignedToName: "João Santos", tags: ["t2"], startedAt: minutesAgo(150), slaDeadline: new Date(now.getTime() - 30 * 60000) },
];

const INITIAL_MESSAGES: Message[] = [
  { id: "m1", conversationId: "c1", content: "Olá, boa tarde!", sender: "client", senderName: "Roberto Almeida", timestamp: minutesAgo(10) },
  { id: "m2", conversationId: "c1", content: "Preciso de ajuda com a nota fiscal", sender: "client", senderName: "Roberto Almeida", timestamp: minutesAgo(2) },
  { id: "m3", conversationId: "c2", content: "Oi, qual o status do meu processo?", sender: "client", senderName: "Fernanda Lima", timestamp: minutesAgo(20) },
  { id: "m4", conversationId: "c2", content: "Olá Fernanda! Estou verificando para você.", sender: "agent", senderName: "João Santos", timestamp: minutesAgo(15) },
  { id: "m5", conversationId: "c2", content: "Qual o status do meu processo?", sender: "client", senderName: "Fernanda Lima", timestamp: minutesAgo(5) },
  { id: "m6", conversationId: "c4", content: "Urgente! Preciso resolver hoje", sender: "client", senderName: "Patricia Ramos", timestamp: minutesAgo(1) },
  { id: "m7", conversationId: "c7", content: "Podem me enviar o boleto?", sender: "client", senderName: "André Barbosa", timestamp: minutesAgo(45) },
  { id: "m8", conversationId: "c7", content: "Claro! Vou gerar e enviar em instantes.", sender: "agent", senderName: "Pedro Costa", timestamp: minutesAgo(40) },
];

const INITIAL_HISTORY: HistoryEntry[] = [
  { id: "h1", conversationId: "c2", action: "Conversa assumida", userId: "u3", userName: "João Santos", timestamp: minutesAgo(15) },
  { id: "h2", conversationId: "c3", action: "Conversa assumida", userId: "u4", userName: "Maria Oliveira", timestamp: minutesAgo(60) },
  { id: "h3", conversationId: "c3", action: "Status alterado para Aguardando cliente", userId: "u4", userName: "Maria Oliveira", timestamp: minutesAgo(30) },
  { id: "h4", conversationId: "c5", action: "Conversa resolvida", userId: "u3", userName: "João Santos", details: "Motivo: Resolvido", timestamp: minutesAgo(120) },
];

// Store state - singleton for in-memory storage
let globalConversations = [...INITIAL_CONVERSATIONS];
let globalMessages = [...INITIAL_MESSAGES];
let globalNotes: InternalNote[] = [];
let globalHistory = [...INITIAL_HISTORY];
let globalCustomers = [...INITIAL_CUSTOMERS];
let globalUsers = [...MOCK_USERS];
let globalIAChatOpen = false;
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
    tags: MOCK_TAGS,
    quickReplies: MOCK_QUICK_REPLIES,
    isIAChatOpen: globalIAChatOpen,
    setIAChatOpen: (open: boolean) => {
      globalIAChatOpen = open;
      notify();
    },
    currentUser: tenantId ? filteredUsers.find((u) => u.tenantId === tenantId) || filteredUsers[0] : MOCK_USERS[0],

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
      const toUser = MOCK_USERS.find((u) => u.id === toUserId);
      if (!toUser) return;
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId
          ? { ...c, assignedTo: toUser.id, assignedToName: toUser.name }
          : c
      );
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

    sendMessage: (conversationId: string, content: string, user: User) => {
      const msg: Message = {
        id: `m${Date.now()}`,
        conversationId,
        content,
        sender: "agent",
        senderName: user.name,
        timestamp: new Date(),
      };
      globalMessages = [...globalMessages, msg];
      globalConversations = globalConversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: content, lastMessageTime: new Date() } : c
      );
      notify();
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
      if (!conversation.slaDeadline) return "dentro_do_prazo";
      const remaining = conversation.slaDeadline.getTime() - Date.now();
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
      if (!globalConversations.find(c => c.id === conv.id)) {
        globalConversations = [conv, ...globalConversations];
        notify();
      }
    },
    addDbMessages: (msgs: Message[]) => {
      const newMsgs = msgs.filter(m => !globalMessages.find(gm => gm.id === m.id));
      if (newMsgs.length > 0) {
        globalMessages = [...globalMessages, ...newMsgs];
        notify();
      }
    },
    setStoreUsers: (users: User[]) => {
      globalUsers = users;
      notify();
    },
    updateStoreUser: (id: string, updates: Partial<User>) => {
      globalUsers = globalUsers.map(u => u.id === id ? { ...u, ...updates } : u);
      notify();
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
