import { cn } from "@/utils/cn";

// Shared row layout for every CommandPalette result section.
export function PaletteRow({
  active,
  onClick,
  onMouseEnter,
  icon,
  title,
  subtitle,
  trailing,
  trailingSub,
}: {
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  trailing?: React.ReactNode;
  trailingSub?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-bg-2" : "hover:bg-bg-2/60",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{title}</span>
        <span className="block truncate text-xs text-fg/50">{subtitle}</span>
      </span>
      {trailing !== undefined && (
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums text-fg">{trailing}</span>
          {trailingSub ? <span className="mt-0.5 block text-2xs font-semibold">{trailingSub}</span> : null}
        </span>
      )}
    </button>
  );
}
