import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  // Em produção remove console.log/debug/info (console.warn/error continuam para diagnóstico)
  esbuild: mode === "production" ? { pure: ["console.log", "console.debug", "console.info"] } : undefined,
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas grandes em arquivos próprios: ficam em cache entre deploys
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          radix: [
            "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover",
            "@radix-ui/react-select", "@radix-ui/react-tooltip", "@radix-ui/react-tabs", "@radix-ui/react-toast",
          ],
        },
      },
    },
  },
}));
