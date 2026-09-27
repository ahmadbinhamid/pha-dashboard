import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ThemeMode } from "@/hooks";

// Theme tile; literal colours so the dark preview stays dark in light mode.
export function ThemeModeCard({
  mode,
  label,
  description,
  icon,
  preview,
  selected,
  onSelect,
}: {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  preview: React.ReactNode;
  selected: boolean;
  onSelect: (mode: ThemeMode) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(mode)}
      className={cn(
        "rounded-xl border-2 p-4 text-left transition-all",
        selected ? "border-accent bg-accent/5 ring-2 ring-accent/20" : "border-border hover:border-fg/20",
      )}
    >
      <div className="mb-3 h-28 w-full overflow-hidden rounded-lg border border-border shadow-inner">{preview}</div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-fg">{label}</h3>
            <p className="truncate text-3xs text-fg/50">{description}</p>
          </div>
        </div>
        {selected ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </div>
    </button>
  );
}

// Preview miniatures; literal zinc/white values for the reason above.
export function LightPreview() {
  return (
    <div className="flex h-full flex-col justify-between bg-zinc-100 p-2.5">
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 rounded bg-zinc-300" />
        <div className="h-4 w-4 rounded-full bg-amber-400" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded border border-zinc-200 bg-white p-1">
            <div className="mb-1 h-2 w-8 rounded bg-zinc-200" />
            <div className="h-3 w-12 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="h-3 w-3/4 rounded bg-zinc-200" />
    </div>
  );
}

export function DarkPreview() {
  return (
    <div className="flex h-full flex-col justify-between bg-zinc-950 p-2.5">
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 rounded bg-zinc-700" />
        <div className="h-4 w-4 rounded-full bg-indigo-400" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded border border-zinc-800 bg-zinc-900 p-1">
            <div className="mb-1 h-2 w-8 rounded bg-zinc-700" />
            <div className="h-3 w-12 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      <div className="h-3 w-3/4 rounded bg-zinc-800" />
    </div>
  );
}

export function SystemPreview() {
  return (
    <div className="flex h-full">
      <div className="flex w-1/2 flex-col justify-between border-r border-zinc-300 bg-zinc-100 p-2">
        <div className="h-2 w-10 rounded bg-zinc-300" />
        <div className="rounded border border-zinc-200 bg-white p-1">
          <div className="h-2 w-6 rounded bg-zinc-800" />
        </div>
        <div className="h-2 w-full rounded bg-zinc-200" />
      </div>
      <div className="flex w-1/2 flex-col justify-between bg-zinc-950 p-2">
        <div className="h-2 w-10 rounded bg-zinc-700" />
        <div className="rounded border border-zinc-800 bg-zinc-900 p-1">
          <div className="h-2 w-6 rounded bg-zinc-200" />
        </div>
        <div className="h-2 w-full rounded bg-zinc-800" />
      </div>
    </div>
  );
}
