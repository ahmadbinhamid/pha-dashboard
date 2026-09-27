import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

// One titled block of settings, the unit every tab is built from. Not <CardHeader>/<CardContent>: those divider under a small-caps title, whereas this leads with a heading + explanatory line and closes with its own Save/Reset row.
export function SettingsSection({
  title,
  description,
  right,
  footer,
  footerDivider = true,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Status chip or small action, aligned opposite the title. */
  right?: React.ReactNode;
  /** Action row, divided off at the foot of the card (usually Reset + Save). */
  footer?: React.ReactNode;
  /** Set false to drop the hairline above `footer`, for a footer that reads as its own block rather than a divided action row. */
  footerDivider?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-fg">{title}</h2>
          {description ? <p className="mt-1 text-xs text-fg/55">{description}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className="mt-5">{children}</div>

      {footer ? (
        <div className={cn("mt-6 flex items-center justify-end gap-3", footerDivider && "border-t border-border pt-4")}>
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

// Two-column field grid used by every settings form; collapses to one column below `sm` where side-by-side inputs get too narrow.
export function SettingsFieldGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2", className)}>{children}</div>;
}
