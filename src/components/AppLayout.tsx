import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
// import { IAChatPanel } from "@/components/IAChat";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const sidebarWidth = sidebarCollapsed ? 80 : 280;
  const sidebarOffset = 20 + sidebarWidth;
  
  return (
    <div className="min-h-screen w-full">
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
              <header className="h-14 flex items-center justify-between border-b border-border/40 bg-white/40 dark:bg-[#021B1A]/40 backdrop-blur-md px-6 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
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
            {/* <IAChatPanel /> */}
          </div>
        </div>
      </div>
    </div>
  );
}