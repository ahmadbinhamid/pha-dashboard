import { cn } from "@/utils/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-md bg-card shadow-card ring-1 ring-inset ring-border", className)}>
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
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {description ? <div className="mt-1 text-xs text-fg/65">{description}</div> : null}
      </div>
      {right ? <div className="shrink-0 sm:self-start">{right}</div> : null}
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

