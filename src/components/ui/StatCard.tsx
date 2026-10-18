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

function StatIcon({ icon: Icon, className }: { icon: StatCardProps["icon"]; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent", className)}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

// Icon + label + value tile. A clickable tile stacks, so text summaries fit.
export function StatCard({ icon, label, children, aside, onClick, active = false, className }: StatCardProps) {
  if (!onClick) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-4", className)}>
        <StatIcon icon={icon} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-fg/55">{label}</div>
          <div className="mt-0.5 text-base font-semibold text-fg">{children}</div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-4 text-left transition-colors",
        "outline-none! focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-accent bg-accent/5" : "border-border hover:border-fg/20 hover:bg-bg-2/40",
        className,
      )}
    >
      <div className="flex w-full items-center gap-2.5">
        <StatIcon icon={icon} className="h-8 w-8" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{label}</span>
        {aside ? <span className="shrink-0">{aside}</span> : null}
      </div>
      <div className="line-clamp-2 text-compact leading-snug text-fg/65">{children}</div>
    </button>
  );
}
