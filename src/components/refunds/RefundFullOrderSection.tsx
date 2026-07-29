import { Checkbox } from "@/components/ui/Checkbox";
import { formatCurrencyFromCents } from "@/utils/format";
import type { RefundableSummary } from "@/types/refund";

interface RefundFullOrderSectionProps {
  summary: RefundableSummary;
  restockAll: boolean;
  onRestockAllChange: (value: boolean) => void;
  refundShipping: boolean;
  onRefundShippingChange: (value: boolean) => void;
}

// refund-redesign-spec.md §7 — "Whole invoice: read-only line list, one
// 'restock all returned items' checkbox, plus a shipping toggle."
export function RefundFullOrderSection({
  summary,
  restockAll,
  onRestockAllChange,
  refundShipping,
  onRefundShippingChange,
}: RefundFullOrderSectionProps) {
  const remainingLines = summary.lines.filter((l) => l.refundable_quantity > 0);

  return (
    <div className="space-y-3">
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xs border border-border p-2">
        {remainingLines.map((line) => (
          <div key={line.order_item_id} className="flex items-center justify-between px-2 py-1.5 text-sm">
            <div className="min-w-0 truncate text-fg">
              {line.name} <span className="text-fg/50">× {line.refundable_quantity}</span>
            </div>
            <div className="shrink-0 text-fg/60">{formatCurrencyFromCents(line.refundable_amount)}</div>
          </div>
        ))}
        {remainingLines.length === 0 && (
          <div className="py-3 text-center text-xs text-fg/50">No refundable items remain — amount-only refund</div>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-fg/80">
        <Checkbox checked={restockAll} onChange={(e) => onRestockAllChange(e.target.checked)} />
        <span>Restock all returned items</span>
      </label>

      {summary.shipping.refundable > 0 && (
        <label className="flex items-start gap-2 text-sm text-fg/80">
          <Checkbox checked={refundShipping} onChange={(e) => onRefundShippingChange(e.target.checked)} />
          <span>Also refund shipping ({formatCurrencyFromCents(summary.shipping.refundable)})</span>
        </label>
      )}
    </div>
  );
}
