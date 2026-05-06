import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global Error Handler for Production Debugging
window.onerror = function(message, source, lineno, colno, error) {
  console.error("GLOBAL ERROR:", { message, source, lineno, colno, error });
  // Se a tela estiver preta por muito tempo, força um reload limpando o estado
  if (window.location.pathname !== "/login" && !document.body.innerText.trim()) {
    console.warn("Blank screen detected, attempting recovery...");
  }
  return false;
};

createRoot(document.getElementById("root")!).render(<App />);
