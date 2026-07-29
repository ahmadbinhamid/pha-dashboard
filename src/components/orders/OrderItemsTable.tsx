import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrencyFromCents, getExclusiveUnitPrice, getLineGst } from "@/utils/format";
import { updateOrderItemPrice, updateOrderItemDiscount } from "@/lib/api/orders";
import { useToast } from "@/context";
import type { OrderChannel, OrderItem } from "@/types/orders";

function EditableUnitPrice({ orderId, itemIndex, item }: { orderId: string; itemIndex: number; item: OrderItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.unit_price / 100));

  const mutation = useMutation({
    mutationFn: (unitPrice: number) => updateOrderItemPrice(orderId, itemIndex, unitPrice),
    onSuccess: () => {
      toast({ title: "Price updated", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update price", description: err.message, tone: "danger" });
    },
  });

  if (editing) {
    return (
      <form
        className="flex items-center justify-end gap-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            toast({ title: "Enter a valid price", tone: "danger" });
            return;
          }
          mutation.mutate(parsed);
        }}
      >
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0.01"
          size="sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 text-right"
          disabled={mutation.isPending}
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={mutation.isPending}
          aria-label="Save price"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={mutation.isPending}
          onClick={() => setEditing(false)}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="group/price inline-flex items-center text-fg hover:text-accent"
      onClick={() => {
        setValue(String(item.unit_price / 100));
        setEditing(true);
      }}
    >
      {/* Absolutely positioned so it never reserves layout space — otherwise
          this value would sit left of the column's right edge even while
          the pencil itself is invisible at opacity-0. */}
      <span className="relative">
        {formatCurrencyFromCents(getExclusiveUnitPrice(item.unit_price))}
        <Pencil className="absolute left-full top-1/2 ml-1.5 h-3 w-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/price:opacity-100" />
      </span>
    </button>
  );
}

function EditableDiscount({ orderId, itemIndex, item }: { orderId: string; itemIndex: number; item: OrderItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.discount_amount / 100));

  const mutation = useMutation({
    mutationFn: (discountAmount: number) => updateOrderItemDiscount(orderId, itemIndex, discountAmount),
    onSuccess: () => {
      toast({ title: "Discount updated", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update discount", description: err.message, tone: "danger" });
    },
  });

  if (editing) {
    return (
      <form
        className="flex items-center justify-end gap-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed < 0) {
            toast({ title: "Enter a valid discount", tone: "danger" });
            return;
          }
          mutation.mutate(parsed);
        }}
      >
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          size="sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 text-right"
          disabled={mutation.isPending}
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={mutation.isPending}
          aria-label="Save discount"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={mutation.isPending}
          onClick={() => setEditing(false)}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="group/discount inline-flex items-center text-fg/60 hover:text-accent"
      onClick={() => {
        setValue(String(item.discount_amount / 100));
        setEditing(true);
      }}
    >
      {/* Absolutely positioned so it never reserves layout space — otherwise
          this value would sit left of the column's right edge even while
          the pencil itself is invisible at opacity-0. */}
      <span className="relative">
        {item.discount_amount > 0 ? `-${formatCurrencyFromCents(item.discount_amount)}` : formatCurrencyFromCents(0)}
        <Pencil className="absolute left-full top-1/2 ml-1.5 h-3 w-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/discount:opacity-100" />
      </span>
    </button>
  );
}

export function OrderItemsTable({
  items,
  orderId,
  channel,
}: {
  items: OrderItem[];
  orderId: string;
  channel: OrderChannel;
}) {
  // eBay and manual (in-store) order prices/discounts can be corrected after
  // the fact — the backend rejects an edit for storefront orders, so don't
  // offer it here.
  const editable = channel === "ebay" || channel === "manual";

  return (
    <div className="max-h-140 overflow-auto">
      <Table className="min-w-140">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 top-0 z-3 min-w-48 sticky-col-header sticky-col-separator-right">
              Item
            </TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header">SKU</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Unit Price (ex GST)</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">GST (11%)</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Qty</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Discount</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Total (inc GST)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={`${item.product}-${item.variant ?? i}`} className="group">
              <TableCell className="sticky left-0 z-1 max-w-48 sticky-col-cell sticky-col-separator-right">
                <div className="truncate font-medium text-fg">{item.name}</div>
                {item.note && (
                  <div className="mt-1 rounded-xs bg-bg-2 px-2 py-1 text-xs text-fg/55">{item.note}</div>
                )}
              </TableCell>
              <TableCell className="text-fg/60">{item.sku ?? "—"}</TableCell>
              <TableCell className="text-right text-fg">
                {editable ? (
                  <EditableUnitPrice orderId={orderId} itemIndex={i} item={item} />
                ) : (
                  formatCurrencyFromCents(getExclusiveUnitPrice(item.unit_price))
                )}
                {item.unit_price_updated_at && (
                  <div className="mt-1 flex justify-end">
                    <Badge variant="warn" className="whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium">
                      Edited{" "}
                      {new Date(item.unit_price_updated_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Badge>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right text-fg/60">
                {formatCurrencyFromCents(getLineGst(item.unit_price))}
              </TableCell>
              <TableCell className="text-right text-fg">{item.quantity}</TableCell>
              <TableCell className="text-right text-fg/60">
                {editable ? (
                  <EditableDiscount orderId={orderId} itemIndex={i} item={item} />
                ) : item.discount_amount > 0 ? (
                  `-${formatCurrencyFromCents(item.discount_amount)}`
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right font-medium text-fg">
                {formatCurrencyFromCents(item.unit_price * item.quantity - item.discount_amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
