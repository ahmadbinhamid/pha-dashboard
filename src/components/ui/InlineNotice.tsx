import { cn } from "@/utils/cn";

export type InlineNoticeVariant = "ok" | "warn" | "danger";

// Same tone names as Badge, so a status maps to both without translation.
const styles: Record<InlineNoticeVariant, string> = {
  ok: "bg-tag-success-bg text-tag-success-fg",
  warn: "bg-tag-warn-bg text-tag-warn-fg",
  danger: "bg-tag-danger-bg text-tag-danger-fg",
};

interface InlineNoticeProps {
  variant: InlineNoticeVariant;
  children: React.ReactNode;
  className?: string;
}

// Inline status message (callback result, error, warning) inside a card.
export function InlineNotice({ variant, children, className }: InlineNoticeProps) {
  return <p className={cn("rounded-xs px-3 py-2 text-sm", styles[variant], className)}>{children}</p>;
}
