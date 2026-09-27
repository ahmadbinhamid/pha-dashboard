import { cn } from "@/utils/cn";

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // A real border, not `ring-1 ring-inset`: an inset ring paints beneath descendants, so a full-bleed child painted over it (card edges vanishing alongside a table header). A border sits outside the padding box.
    <div className={cn("rounded-2xl border border-border bg-card shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  description,
  right,
}: {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    // Always a row, even on mobile: `right` is usually a small action that reads naturally next to the title; dropping to its own line looked broken. Title keeps min-w-0 so it wraps/truncates instead of pushing `right` off-screen.
    <div
      className={cn(
        "flex flex-row items-start justify-between gap-3 border-b border-border px-4 py-4 sm:gap-4 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {description ? <div className="mt-1 text-xs text-fg/65">{description}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-4 py-4 sm:px-5 sm:py-4", className)}>{children}</div>;
}

