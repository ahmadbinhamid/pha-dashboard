import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DiscountStatusBadge } from "@/components/discounts/DiscountStatusBadge";
import { discountConditions, discountHeadline, discountSchedule } from "@/lib/discounts/discountDisplay";
import { DISCOUNTS_BASE_PATH } from "@/config/discounts";
import type { Discount } from "@/types/discount";

/** The featured discount's offer and rules, with a link to edit it. */
export function FeaturedDiscountSummary({ discount }: { discount: Discount }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-bg-2/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-fg">{discountHeadline(discount)}</p>
          <p className="text-xs text-fg/55">{discountConditions(discount)} · {discountSchedule(discount)}</p>
        </div>
        <DiscountStatusBadge status={discount.status} />
      </div>
      <div className="flex items-center justify-between gap-3">
        {discount.is_automatic ? (
          <Badge variant="outline" className="gap-1 text-2xs">
            <Sparkles className="h-3 w-3" />
            Automatic
          </Badge>
        ) : (
          <Badge variant="outline" className="font-mono text-2xs">
            {discount.code}
          </Badge>
        )}
        <Link to={`${DISCOUNTS_BASE_PATH}/${discount._id}`} className="flex items-center gap-1 text-xs font-medium text-fg/55 hover:text-accent">
          Edit discount
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {discount.status !== "live" ? (
        <p className="text-xs text-warn">Not live, so the storefront won't show it until it is.</p>
      ) : null}
    </div>
  );
}
