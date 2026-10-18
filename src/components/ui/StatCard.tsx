import type { ComponentType, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  // Right-aligned extra, e.g. a status badge.
  aside?: ReactNode;
  // Makes the tile a button, e.g. to switch the section it summarises.
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

// Generic icon + label + value tile for small metrics.
export function StatCard({ icon: Icon, label, children, aside, onClick, active = false, className }: StatCardProps) {
  const body = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wider text-fg/45">{label}</div>
        <div className={cn("mt-0.5 text-base font-semibold text-fg", onClick && "truncate")}>{children}</div>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </>
  );
  const base = cn("flex items-center gap-3 rounded-xl border bg-card p-4 text-left", className);

  if (!onClick) return <div className={cn(base, "border-border")}>{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        base,
        "transition-colors outline-none! focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-accent ring-1 ring-accent" : "border-border hover:bg-muted/60",
      )}
    >
      {body}
    </button>
  );
}
