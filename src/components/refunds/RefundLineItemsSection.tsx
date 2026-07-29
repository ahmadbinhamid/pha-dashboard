import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { formatCurrencyFromCents } from "@/utils/format";
import type { RefundableLine } from "@/types/refund";

export interface LineSelection {
  quantity: number;
  restock: boolean;
}

interface RefundLineItemsSectionProps {
  lines: RefundableLine[];
  selection: Map<string, LineSelection>;
  onChange: (orderItemId: string, next: LineSelection | null) => void;
  restockDefault: boolean;
}

// refund-redesign-spec.md §7 — "searchable checkbox list of lines with
// refundable_quantity > 0. Per line: a quantity stepper capped at
// refundable_quantity, and its own restock checkbox defaulted from the
// reason. Disable the restock checkbox with a tooltip when
// has_inventory_record is false. Lines already fully refunded show as
// struck through, not hidden."
export function RefundLineItemsSection({ lines, selection, onChange, restockDefault }: RefundLineItemsSectionProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.sku ?? "").toLowerCase().includes(q),
    );
  }, [lines, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items or SKU…"
          className="pl-8"
        />
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xs border border-border p-2">
        {filtered.length === 0 && <div className="py-4 text-center text-xs text-fg/50">No matching items</div>}
        {filtered.map((line) => {
          const fullyRefunded = line.refundable_quantity <= 0;
          const picked = selection.get(line.order_item_id);
          const checked = !!picked;

          return (
            <div
              key={line.order_item_id}
              className={`flex items-center gap-3 rounded-xs px-2 py-2 ${fullyRefunded ? "opacity-50" : "hover:bg-bg-2"}`}
            >
              <Checkbox
                checked={checked}
                disabled={fullyRefunded}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange(line.order_item_id, { quantity: 1, restock: restockDefault && line.has_inventory_record });
                  } else {
                    onChange(line.order_item_id, null);
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium text-fg ${fullyRefunded ? "line-through" : ""}`}>
                  {line.name}
                </div>
                <div className="text-xs text-fg/50">
                  {line.sku ?? "—"} · {formatCurrencyFromCents(line.effective_unit_price)} each ·{" "}
                  {fullyRefunded ? "fully refunded" : `${line.refundable_quantity} refundable`}
                </div>
              </div>

              {checked && !fullyRefunded && (
                <div className="flex items-center gap-3">
                  <QuantityStepper
                    value={picked.quantity}
                    max={line.refundable_quantity}
                    onChange={(q) => onChange(line.order_item_id, { ...picked, quantity: q })}
                  />
                  <label
                    className="flex items-center gap-1.5 text-xs text-fg/60"
                    title={!line.has_inventory_record ? "No inventory record for this item — can't restock" : undefined}
                  >
                    <Checkbox
                      checked={picked.restock}
                      disabled={!line.has_inventory_record}
                      onChange={(e) => onChange(line.order_item_id, { ...picked, restock: e.target.checked })}
                    />
                    Restock
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
