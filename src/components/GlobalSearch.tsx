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
    subtitle: (c.lastMessage || "").slice(0, 50),
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
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-[280px] items-center gap-2 rounded-full bg-card px-3.5 text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Buscar cliente, CNPJ ou conversa</span>
        <kbd className="rounded-md border border-border px-1.5 text-[11px] font-bold text-muted-foreground">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground xl:hidden"
      >
        <Search className="h-4 w-4" />
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