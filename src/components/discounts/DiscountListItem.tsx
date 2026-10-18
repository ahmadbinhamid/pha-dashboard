import { Megaphone, Sparkles, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DiscountRowActionsMenu } from "@/components/discounts/DiscountRowActionsMenu";
import { DiscountStatusBadge } from "@/components/discounts/DiscountStatusBadge";
import { describeDiscount, discountStatusReason } from "@/lib/discounts/discountDisplay";
import type { Discount } from "@/types/discount";
import { cn } from "@/utils/cn";

interface DiscountListItemProps {
  discount: Discount;
  promoted: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

/** One discount as a readable row: what it is, what it does, how it's doing. */
export function DiscountListItem({ discount: d, promoted, onOpen, onDuplicate, onToggleActive, onDelete }: DiscountListItemProps) {
  const reason = discountStatusReason(d);
  const Icon = d.is_automatic ? Sparkles : Ticket;
  const usedPct = d.usage_limit ? Math.min(100, Math.round((d.usage_count / d.usage_limit) * 100)) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors outline-none! hover:bg-muted/40 focus-visible:bg-muted/40 sm:px-5"
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", d.status === "live" ? "bg-accent/10 text-accent" : "bg-bg-2 text-fg/40")}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{d.name}</span>
          {d.code ? (
            <Badge variant="outline" className="font-mono text-2xs">
              {d.code}
            </Badge>
          ) : null}
          {promoted ? (
            <Badge variant="ok" className="gap-1 text-2xs">
              <Megaphone className="h-3 w-3" />
              Promoted
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-fg/60">{describeDiscount(d)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg/50">
          <span className="tabular-nums">
            {d.usage_count} used{d.usage_limit ? ` of ${d.usage_limit}` : ""}
          </span>
          {usedPct != null ? (
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-2">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
            </span>
          ) : null}
          {reason ? <span>· {reason}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <DiscountStatusBadge status={d.status} />
        <DiscountRowActionsMenu active={d.active} onEdit={onOpen} onDuplicate={onDuplicate} onToggleActive={onToggleActive} onDelete={onDelete} />
      </div>
    </div>
  );
}
