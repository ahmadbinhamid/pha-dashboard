import { Percent, Receipt, ShoppingCart } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import type { DiscountUsage } from "@/types/discount";
import { formatCurrencyFromCents } from "@/utils/format";

export function DiscountUsageStats({ usage }: { usage: DiscountUsage }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard icon={ShoppingCart} label="Orders">
        {usage.orders_count}
      </StatCard>
      <StatCard icon={Receipt} label="Order total">
        {formatCurrencyFromCents(usage.order_total)}
      </StatCard>
      <StatCard icon={Percent} label="Total discounted">
        {formatCurrencyFromCents(usage.discount_total)}
      </StatCard>
    </div>
  );
}
