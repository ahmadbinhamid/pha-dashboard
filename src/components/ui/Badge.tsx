import { cn } from "@/utils/cn";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

const styles: Record<BadgeVariant, string> = {
  default: "bg-muted text-fg ring-1 ring-inset ring-border",
  ok: "bg-tag-success-bg text-tag-success-fg",
  warn: "bg-tag-warn-bg text-tag-warn-fg",
  danger: "bg-tag-danger-bg text-tag-danger-fg",
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

