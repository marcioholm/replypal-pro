import { useEffect, useCallback, useRef, useState } from "react";

interface NavigationConfig {
  items: { id: string }[];
  selectedIndex: number;
  onSelect: (id: string) => void;
  onMove: (direction: "up" | "down") => number;
  enabled?: boolean;
}

export function useListNavigation({ items, selectedIndex, onSelect, onMove, enabled = true }: NavigationConfig) {
  const [index, setIndex] = useState(selectedIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (event.key === "j" || event.key === "J" || event.key === "ArrowDown") {
        event.preventDefault();
        const newIndex = onMove("down");
        setIndex(newIndex);
        scrollToItem(newIndex);
      } else if (event.key === "k" || event.key === "K" || event.key === "ArrowUp") {
        event.preventDefault();
        const newIndex = onMove("up");
        setIndex(newIndex);
        scrollToItem(newIndex);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (items[index]) {
          onSelect(items[index].id);
        }
      } else if (event.key === "g") {
        event.preventDefault();
        setIndex(0);
        scrollToItem(0);
      } else if (event.key === "G") {
        event.preventDefault();
        const lastIndex = items.length - 1;
        setIndex(lastIndex);
        scrollToItem(lastIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, items, index, onSelect, onMove]);

  const scrollToItem = (itemIndex: number) => {
    if (containerRef.current) {
      const container = containerRef.current;
      const buttons = container.querySelectorAll("button[data-conversation-id]");
      const button = buttons[itemIndex] as HTMLElement;
      if (button) {
        button.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  return { index, setIndex, containerRef };
}

export function useListKeyboardNav(
  items: { id: string }[],
  onSelect: (id: string) => void,
  enabled = true
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((direction: "up" | "down") => {
    setSelectedIndex((prev) => {
      if (direction === "down") {
        return Math.min(prev + 1, items.length - 1);
      } else {
        return Math.max(prev - 1, 0);
      }
    });
  }, [items.length]);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
  }, [onSelect]);

  useListNavigation({
    items,
    selectedIndex,
    onSelect: handleSelect,
    onMove: handleMove,
    enabled,
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  return { selectedIndex, setSelectedIndex, containerRef };
}

export const SHORTCUTS_HELP = [
  { key: "J / ↓", description: "Próxima conversa" },
  { key: "K / ↑", description: "Conversa anterior" },
  { key: "Enter", description: "Abrir conversa" },
  { key: "g", description: "Ir para primeira" },
  { key: "G", description: "Ir para última" },
];