import { Info } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

export function DashboardSectionLabel({
  children,
  badge,
  badgeVariant = "default",
  description,
}: {
  children: React.ReactNode;
  /** Small pill next to the title — e.g. "Daily Cycle", "6 Months", "3 Urgent". */
  badge?: React.ReactNode;
  badgeVariant?: BadgeVariant;
  // Shown via a small (i) tooltip rather than a subheading, so card headers stay the same height whether or not one is set.
  description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <h3 className="text-sm font-bold tracking-tight text-fg sm:text-base">{children}</h3>
      {description ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-fg/35 transition-colors hover:text-fg/60"
              aria-label="More info"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 normal-case">
            {description}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
    </div>
  );
}
