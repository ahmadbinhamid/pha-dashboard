import { ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CartItemRow } from "@/components/pos/CartItemRow";
import { useCart } from "@/context/cart";
import { formatCurrency, getLineGst } from "@/utils/format";

// The running order, pinned beside steps 1 and 2. Used to live only inside Add Products and vanished once you moved to Customer; Step 3 keeps its own richer summary since discounts/shipping/payment are editable there.
export function OrderSummaryPanel({ className }: { className?: string }) {
  const { items, totalItems, totalPrice } = useCart();

  // GST-inclusive AU pricing: extracted from the total, never added on top (utils/format.ts#getLineGst). Labelled items-only since shipping/discounts aren't known until step 3.
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
        // Caps at roughly six lines before scrolling so a large order can't push totals below the fold.
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
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(totalPrice)}</span>
        </div>
        <p className="pt-1 text-xs text-fg/45">Discounts, freight and payment are set at Review.</p>
      </div>
    </Card>
  );
}
