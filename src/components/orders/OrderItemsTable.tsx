import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderItem } from "@/types/orders";

// "Discount" is only ever non-zero on manual/admin-created orders — shown
// for every order regardless, so a spot-check always has the full picture,
// but it reads as "—" for the storefront/eBay orders that never discount.
const HEADERS = [
  { label: "Item", align: "left" },
  { label: "SKU", align: "left" },
  { label: "Qty", align: "right" },
  { label: "Unit Price", align: "right" },
  { label: "Discount", align: "right" },
  { label: "Line Total", align: "right" },
];

export function OrderItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-2/40">
            {HEADERS.map((h, i) => (
              <th
                key={i}
                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-fg/45 ${
                  h.align === "right" ? "text-right" : "text-left"
                } first:px-5`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={`${item.product}-${item.variant ?? i}`}>
              <td className="px-5 py-3.5">
                <div className="font-medium text-fg">{item.name}</div>
                {item.note && (
                  <div className="mt-1 rounded-xs bg-bg-2 px-2 py-1 text-xs text-fg/55">{item.note}</div>
                )}
              </td>
              <td className="px-4 py-3.5 text-fg/60">{item.sku ?? "—"}</td>
              <td className="px-4 py-3.5 text-right text-fg">{item.quantity}</td>
              <td className="px-4 py-3.5 text-right text-fg">{formatCurrencyFromCents(item.unit_price)}</td>
              <td className="px-4 py-3.5 text-right text-fg/60">
                {item.discount_amount > 0 ? `-${formatCurrencyFromCents(item.discount_amount)}` : "—"}
              </td>
              <td className="px-5 py-3.5 text-right font-medium text-fg">
                {formatCurrencyFromCents(item.unit_price * item.quantity - item.discount_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
