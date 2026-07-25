import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderItem } from "@/types/orders";

export function OrderItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-140">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-2 min-w-48 sticky-col-header sticky-col-separator-right">
              Item
            </TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Discount</TableHead>
            <TableHead className="text-right">Line Total</TableHead>
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
              <TableCell className="text-right text-fg">{item.quantity}</TableCell>
              <TableCell className="text-right text-fg">{formatCurrencyFromCents(item.unit_price)}</TableCell>
              <TableCell className="text-right text-fg/60">
                {item.discount_amount > 0 ? `-${formatCurrencyFromCents(item.discount_amount)}` : "—"}
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
