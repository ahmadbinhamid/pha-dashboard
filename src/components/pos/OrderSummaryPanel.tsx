import { ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CartItemRow } from "@/components/pos/CartItemRow";
import { useCart } from "@/context/cart";
import { formatCurrency, getLineGst } from "@/utils/format";

interface OrderSummaryPanelProps {
  // Pickup chosen on step 2: freight isn't charged, matching the backend.
  pickup?: boolean;
  className?: string;
}

// Running order beside steps 1-2; Review keeps its own editable summary.
export function OrderSummaryPanel({ pickup = false, className }: OrderSummaryPanelProps) {
  const { items, totalItems, totalPrice, totalShipping } = useCart();
  const shipping = pickup ? 0 : totalShipping;

  // AU prices include GST, so it's extracted from the items, never added.
  const gst = getLineGst(Math.round(totalPrice * 100)) / 100;

  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-fg">Order Summary</h2>
        <Badge variant={totalItems > 0 ? "default" : "muted"}>
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </Badge>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
          <ShoppingCart className="h-7 w-7 text-fg/20" />
          <p className="text-sm text-fg/50">Nothing added yet</p>
          <p className="text-xs text-fg/40">Add products from the list to get started.</p>
        </div>
      ) : (
        // ~6 lines then scroll, so a big order can't push totals off-screen.
        <div className="max-h-[26rem] divide-y divide-border/60 overflow-y-auto">
          {items.map((item) => (
            <CartItemRow key={item.key} item={item} />
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-border px-5 py-4 text-sm">
        <div className="flex justify-between text-fg/60">
          <span>Items subtotal</span>
          <span className="tabular-nums">{formatCurrency(totalPrice)}</span>
        </div>
        <div className="flex justify-between text-fg/45">
          <span>Incl. GST</span>
          <span className="tabular-nums">{formatCurrency(gst)}</span>
        </div>
        <div className="flex justify-between text-fg/60">
          <span>{pickup ? "Shipping (pickup)" : "Shipping"}</span>
          <span className="tabular-nums">{formatCurrency(shipping)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(totalPrice + shipping)}</span>
        </div>
        <p className="pt-1 text-xs text-fg/45">
          {pickup && totalShipping > 0
            ? "Pickup orders aren't charged shipping."
            : "Discounts, freight edits and payment are set at Review."}
        </p>
      </div>
    </Card>
  );
}
