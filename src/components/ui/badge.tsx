import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

const styles: Record<BadgeVariant, string> = {
  default: "bg-bg-2 text-fg ring-1 ring-inset ring-border",
  ok: "bg-[hsl(var(--ok))]/12 text-[hsl(var(--ok))] ring-1 ring-inset ring-[hsl(var(--ok))]/25",
  warn: "bg-[hsl(var(--warn))]/14 text-[hsl(var(--warn))] ring-1 ring-inset ring-[hsl(var(--warn))]/25",
  danger:
    "bg-[hsl(var(--danger))]/14 text-[hsl(var(--danger))] ring-1 ring-inset ring-[hsl(var(--danger))]/25",
  muted: "bg-transparent text-fg/65 ring-1 ring-inset ring-border",
  outline: "bg-transparent text-fg ring-1 ring-inset ring-border",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

