import { useState } from "react";
import { FileText, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { useCart } from "@/context/cart";
import { formatCurrency } from "@/utils/format";
import type { CartItem } from "@/types/cart";

interface CartItemRowProps {
  item: CartItem;
  // Review Order step shows a per-line discount input; Add Products step's
  // basket doesn't (discounts are decided at review time, not while shopping).
  discountValue?: string;
  onDiscountChange?: (value: string) => void;
  lineTotal?: number; // dollars, post-discount — falls back to unit_price*qty when omitted
}

export function CartItemRow({ item, discountValue, onDiscountChange, lineTotal }: CartItemRowProps) {
  const { removeItem, setQuantity, setItemNote } = useCart();
  const [noteOpen, setNoteOpen] = useState(!!item.note);
  const showDiscount = onDiscountChange !== undefined;
  const total = lineTotal ?? item.unit_price * item.quantity;

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xs border border-border bg-bg-2">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-4 w-4 text-fg/25" />
          </div>
        )}
      </div>

      <div className="min-w-40 flex-1">
        <div className="truncate font-medium text-fg">{item.name}</div>
        {noteOpen ? (
          <Input
            value={item.note ?? ""}
            onChange={(e) => setItemNote(item.key, e.target.value)}
            placeholder="Add a note for this product…"
            size="sm"
            className="mt-1"
            autoFocus={!item.note}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg/45 transition hover:text-fg/70"
          >
            <FileText className="h-3 w-3" />
            Add note
          </button>
        )}
      </div>

      {showDiscount && (
        <div className="shrink-0">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg/40">
            Discount
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={discountValue ?? ""}
            onChange={(e) => onDiscountChange?.(e.target.value)}
            placeholder="0.00"
            size="sm"
            className="w-24"
          />
        </div>
      )}

      <QuantityStepper value={item.quantity} max={item.max_quantity} onChange={(q) => setQuantity(item.key, q)} />

      <div className="w-24 shrink-0 text-right">
        <div className="text-xs text-fg/45">
          {item.quantity}× {formatCurrency(item.unit_price)}
        </div>
        <div className="font-semibold text-fg">{formatCurrency(total)}</div>
      </div>

      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(item.key)}>
        <Trash2 className="h-3.5 w-3.5 text-danger" />
      </Button>
    </div>
  );
}
