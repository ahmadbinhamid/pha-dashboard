import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Check, X } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrencyFromCents, getExclusiveUnitPrice, getLineGst } from "@/utils/format";
import { updateOrderItemPrice, updateOrderItemDiscount } from "@/lib/api/orders";
import { useOrderEdit } from "@/hooks/useOrderEdit";
import { OrderItemQuantityStepper } from "@/components/orders/OrderItemQuantityStepper";
import { RemoveOrderItemButton } from "@/components/orders/RemoveOrderItemButton";
import type { OrderItem } from "@/types/orders";
import {
  editableUnitPriceFormSchema,
  editableDiscountFormSchema,
  type EditableUnitPriceFormValues,
  type EditableDiscountFormValues,
} from "@/lib/validation/editableOrderItem";

interface EditableLineProps {
  orderId: string;
  version: number;
  itemIndex: number;
  item: OrderItem;
}

function EditableUnitPrice({ orderId, version, itemIndex, item }: EditableLineProps) {
  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, reset } = useForm<EditableUnitPriceFormValues>({
    resolver: zodResolver(editableUnitPriceFormSchema),
    defaultValues: { amount: String(item.unit_price / 100) },
  });

  const mutation = useOrderEdit(
    orderId,
    (unitPrice: number) => updateOrderItemPrice(orderId, itemIndex, unitPrice, version),
    { successTitle: "Price updated", errorTitle: "Couldn't update price", onSuccess: () => setEditing(false) },
  );

  const onSubmit = (values: EditableUnitPriceFormValues) => mutation.mutate(Number(values.amount));

  if (editing) {
    return (
      <form className="flex items-center justify-end gap-0.5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0.01"
          size="sm"
          className="w-24 text-right"
          disabled={mutation.isPending}
          {...register("amount")}
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
        reset({ amount: String(item.unit_price / 100) });
        setEditing(true);
      }}
    >
      {/* Absolute so it reserves no space and stays at the column's right edge. */}
      <span className="relative">
        {formatCurrencyFromCents(getExclusiveUnitPrice(item.unit_price))}
        <Pencil className="absolute left-full top-1/2 ml-1.5 h-3 w-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/price:opacity-100" />
      </span>
    </button>
  );
}

function EditableDiscount({ orderId, version, itemIndex, item }: EditableLineProps) {
  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, reset } = useForm<EditableDiscountFormValues>({
    resolver: zodResolver(editableDiscountFormSchema),
    defaultValues: { amount: String(item.discount_amount / 100) },
  });

  const mutation = useOrderEdit(
    orderId,
    (discountAmount: number) => updateOrderItemDiscount(orderId, itemIndex, discountAmount, version),
    { successTitle: "Discount updated", errorTitle: "Couldn't update discount", onSuccess: () => setEditing(false) },
  );

  const onSubmit = (values: EditableDiscountFormValues) => mutation.mutate(Number(values.amount));

  if (editing) {
    return (
      <form className="flex items-center justify-end gap-0.5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          size="sm"
          className="w-24 text-right"
          disabled={mutation.isPending}
          {...register("amount")}
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
        reset({ amount: String(item.discount_amount / 100) });
        setEditing(true);
      }}
    >
      {/* Absolute so it reserves no space and stays at the column's right edge. */}
      <span className="relative">
        {item.discount_amount > 0 ? `-${formatCurrencyFromCents(item.discount_amount)}` : formatCurrencyFromCents(0)}
        <Pencil className="absolute left-full top-1/2 ml-1.5 h-3 w-3 -translate-y-1/2 opacity-0 transition-opacity group-hover/discount:opacity-100" />
      </span>
    </button>
  );
}

interface OrderItemsTableProps {
  items: OrderItem[];
  orderId: string;
  version: number;
  // Server-decided (edit_block_reason) and the caller's orders.update.
  editable: boolean;
}

export function OrderItemsTable({ items, orderId, version, editable }: OrderItemsTableProps) {
  const [itemColWidth, setItemColWidth] = useState<number | null>(null);

  return (
    <div className="max-h-140 overflow-auto">
      <Table className="min-w-140">
        <TableHeader>
          <TableRow>
            <StickyTableHead
              size={48}
              width={itemColWidth ?? undefined}
              onResize={setItemColWidth}
              className="top-0 z-3"
            >
              Item
            </StickyTableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header">SKU</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Unit Price (ex GST)</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">GST (11%)</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Qty</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Discount</TableHead>
            <TableHead className="sticky top-0 z-2 sticky-col-header text-right">Total (inc GST)</TableHead>
            {editable && <TableHead className="sticky top-0 z-2 sticky-col-header" aria-label="Remove" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={item._id ?? i} className="group">
              <StickyTableCell size={48} width={itemColWidth ?? undefined} onResize={setItemColWidth}>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate font-medium text-fg">{item.name}</div>
                  {item.is_custom && (
                    <Badge variant="muted" className="shrink-0 px-1.5 py-0.5 text-3xs font-medium">
                      Custom
                    </Badge>
                  )}
                </div>
                {item.note && (
                  <div className="mt-1 rounded-xs bg-bg-2 px-2 py-1 text-xs text-fg/55">{item.note}</div>
                )}
              </StickyTableCell>
              <TableCell className="text-fg/60">{item.sku ?? "—"}</TableCell>
              <TableCell className="text-right text-fg">
                {editable ? (
                  <EditableUnitPrice orderId={orderId} version={version} itemIndex={i} item={item} />
                ) : (
                  formatCurrencyFromCents(getExclusiveUnitPrice(item.unit_price))
                )}
                {item.unit_price_updated_at && (
                  <div className="mt-1 flex justify-end">
                    <Badge variant="warn" className="whitespace-nowrap px-1.5 py-0.5 text-3xs font-medium">
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
              <TableCell className="text-right text-fg">
                {editable ? <OrderItemQuantityStepper orderId={orderId} version={version} item={item} /> : item.quantity}
              </TableCell>
              <TableCell className="text-right text-fg/60">
                {editable ? (
                  <EditableDiscount orderId={orderId} version={version} itemIndex={i} item={item} />
                ) : item.discount_amount > 0 ? (
                  `-${formatCurrencyFromCents(item.discount_amount)}`
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right font-medium text-fg">
                {formatCurrencyFromCents(item.unit_price * item.quantity - item.discount_amount)}
              </TableCell>
              {editable && (
                <TableCell className="text-right">
                  <RemoveOrderItemButton orderId={orderId} version={version} item={item} disabled={items.length === 1} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
