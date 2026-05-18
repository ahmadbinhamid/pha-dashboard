import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonClassName } from "@/components/ui/button-styles";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-bg px-6 py-10 text-center",
        className,
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="max-w-md text-sm text-fg/65">{description}</div>
      {actionLabel && actionHref ? (
        <div className="mt-3">
          <Link
            href={actionHref}
            className={buttonClassName({ className: "h-10" })}
          >
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

