import { useEffect, useCallback, useRef } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcutsRef.current) {
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [enabled]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export function useGlobalShortcuts() {
  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      description: "Abrir busca"
    },
    {
      key: "Escape",
      description: "Fechar modal/dialog"
    },
    {
      key: "d",
      ctrl: true,
      description: "Ir para Dashboard"
    },
    {
      key: "i",
      ctrl: true,
      description: "Ir para Inbox"
    },
    {
      key: "p",
      ctrl: true,
      description: "Ir para Pipeline"
    },
  ]);
}

export const SHORTCUT_DESCRIPTIONS: Record<string, string> = {
  "Ctrl+K": "Abrir busca",
  "Ctrl+D": "Dashboard",
  "Ctrl+I": "Inbox",
  "Ctrl+P": "Pipeline",
  "Esc": "Fechar",
};