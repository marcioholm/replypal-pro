/**
 * Peças visuais compartilhadas do Conta+ (chips, avatares de iniciais,
 * grupos de filtro e pílulas). Seguem o protótipo "Conta+ — Redesign UI/UX".
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "blue" | "navy" | "soft" | "green" | "amber" | "red" | "grey" | "violet";

const CHIP_TONES: Record<ChipTone, string> = {
  blue: "bg-primary text-primary-foreground",
  navy: "bg-[hsl(215_84%_26%)] text-white dark:bg-primary dark:text-primary-foreground",
  soft: "bg-accent text-accent-foreground",
  green: "bg-success/10 text-success",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300",
  red: "bg-destructive/10 text-destructive",
  grey: "bg-muted text-muted-foreground",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
};

export function Chip({ tone = "soft", className, children }: { tone?: ChipTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold leading-none",
        CHIP_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const TILE_TONES = [
  "bg-accent text-accent-foreground",
  "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
  "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name?: string | null) {
  const parts = (name || "?").replace(/[^\p{L}\p{N} ]/gu, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface InitialsAvatarProps {
  name?: string | null;
  src?: string | null;
  /** px */
  size?: number;
  /** "circle" (pessoas) ou "tile" (empresas) */
  shape?: "circle" | "tile";
  className?: string;
  icon?: ReactNode;
  onImageError?: () => void;
}

/** Avatar com foto (se houver) ou iniciais sobre uma cor estável derivada do nome. */
export function InitialsAvatar({ name, src, size = 44, shape = "circle", className, icon, onImageError }: InitialsAvatarProps) {
  const tone = TILE_TONES[hash(name || "") % TILE_TONES.length];
  const radius = shape === "circle" ? "rounded-full" : size >= 72 ? "rounded-[18px]" : "rounded-xl";
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden font-bold", radius, tone, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      {icon ?? initialsOf(name)}
      {src && (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={e => {
            e.currentTarget.style.display = "none";
            onImageError?.();
          }}
        />
      )}
    </span>
  );
}

/** Grupo de filtros com título (fieldset acessível). */
export function FilterGroup({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("m-0 flex flex-col gap-2.5 border-0 p-0", className)}>
      <legend className="mb-2.5 p-0 text-sm font-extrabold text-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Pílula de alternância (ex.: Todas / Fila / Minhas). */
export function PillToggle({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-[hsl(215_84%_26%)] bg-[hsl(215_84%_26%)] text-white dark:border-primary dark:bg-primary dark:text-primary-foreground"
          : "border-[hsl(215_84%_34%)] bg-transparent text-[hsl(215_84%_34%)] hover:bg-accent dark:border-primary/60 dark:text-primary"
      )}
    >
      {children}
      {count !== undefined && count > 0 && <span className="tabular opacity-80">{count}</span>}
    </button>
  );
}

/** Linha de opção (radio ou checkbox) com contador à direita. */
export function FilterOption({
  type,
  name,
  label,
  count,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name?: string;
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="m-0 h-[15px] w-[15px] accent-[hsl(var(--primary))]"
      />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground tabular">{count}</span>}
    </label>
  );
}

/** Banner azul de destaque (prazos fiscais, higienização...). */
export function HighlightBanner({
  icon,
  big,
  bigLabel,
  text,
  action,
  aside,
}: {
  icon: ReactNode;
  big: ReactNode;
  bigLabel: ReactNode;
  text: ReactNode;
  action?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="flex min-h-[124px] items-stretch overflow-hidden rounded-[22px] bg-primary text-primary-foreground">
      <div className="hidden w-[150px] shrink-0 items-center justify-center opacity-90 lg:flex">{icon}</div>
      <div className="flex flex-1 flex-wrap items-center gap-x-7 gap-y-3 px-6 py-5 lg:px-0">
        <div className="leading-[0.9]">
          <div className="text-5xl font-extrabold tracking-tight tabular">{big}</div>
          <div className="mt-2 text-[15px] font-bold">{bigLabel}</div>
        </div>
        <div className="flex max-w-[280px] flex-col gap-2.5">
          <span className="text-[13px] leading-snug text-primary-foreground/85">{text}</span>
          {action}
        </div>
      </div>
      {aside && (
        <div className="m-3 hidden w-[240px] shrink-0 flex-col justify-between rounded-2xl bg-card p-4 text-card-foreground md:flex">
          {aside}
        </div>
      )}
    </section>
  );
}
