import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Search, MessageSquare, User, Settings, LayoutDashboard, Columns3, Calendar, FileText } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const store = useStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  const conversations = store.conversations.map(c => ({
    id: c.id,
    type: "conversation" as const,
    title: c.clientName,
    subtitle: c.lastMessage.slice(0, 50),
    icon: MessageSquare,
    url: `/chat/${c.id}`
  }));

  const customers = store.customers.map(c => ({
    id: c.id,
    type: "customer" as const,
    title: c.name,
    subtitle: c.razaoSocial,
    icon: User,
    url: `/customers/${c.id}`
  }));

  const allItems = [
    { id: "dashboard", type: "nav" as const, title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
    { id: "pipeline", type: "nav" as const, title: "Pipeline", icon: Columns3, url: "/pipeline" },
    { id: "customers", type: "nav" as const, title: "Clientes", icon: User, url: "/customers" },
    { id: "calendar", type: "nav" as const, title: "Calendário Fiscal", icon: Calendar, url: "/calendar" },
    { id: "settings", type: "nav" as const, title: "Configurações", icon: Settings, url: "/settings" },
    ...conversations,
    ...customers
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground bg-white/20 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/40 rounded-xl border border-white/20 dark:border-white/10 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
      >
        <Search className="w-4 h-4 text-primary" />
        <span className="hidden sm:inline font-medium">Pesquisar sistema...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded-md border bg-muted/50 px-1.5 font-mono text-[10px] font-bold text-muted-foreground ml-4 shadow-sm">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar conversas, clientes, páginas..." className="h-12" />
        <CommandList className="max-h-[400px]">
          <CommandEmpty className="py-6 text-sm text-muted-foreground">Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {allItems.filter(i => i.type === "nav").map(item => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item.url)} className="cursor-pointer">
                <item.icon className="w-4 h-4 mr-2" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Conversas">
            {conversations.slice(0, 5).map(item => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item.url)} className="cursor-pointer">
                <item.icon className="w-4 h-4 mr-2" />
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Clientes">
            {customers.slice(0, 5).map(item => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item.url)} className="cursor-pointer">
                <item.icon className="w-4 h-4 mr-2" />
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}