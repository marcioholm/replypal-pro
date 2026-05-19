import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { IAChatPanel } from "@/components/IAChat";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { NotificationManager } from "@/components/NotificationManager";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const sidebarWidth = sidebarCollapsed ? 80 : 280;
  const sidebarOffset = sidebarWidth;
  
  return (
    <div className="min-h-screen w-full bg-background">
      <NotificationManager />
      <div className="relative">
        <AppSidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div 
          className="transition-all duration-350 ease-out"
          style={{ paddingLeft: sidebarOffset }}
        >
          <div className="flex flex-row min-h-screen">
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-14 flex items-center justify-between border-b border-border bg-white dark:bg-[#12100e] px-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <GlobalSearch />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-8 w-8 p-0"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </Button>
              </header>
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
            <IAChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}