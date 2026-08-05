import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Landmark } from "lucide-react";
import { TenantLogo } from "@/components/branding/TenantLogo";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { formatCurrencyFromCents, getExclusiveUnitPrice, getLineGst, formatOrderNumber, formatInvoiceNumber } from "@/utils/format";
import { getTotalPaid, getBalanceDue, getTotalRefunded } from "@/utils/paymentTotals";
import type { OrderDetail } from "@/types/orders";

// Print-only invoice, structured to match the tax-invoice PDF attached to
// the pickup-ready/shipped emails (order.service.js#sendOrderNotification)
// — same sections, same fields — so a printed copy and the emailed copy
// never disagree. Deliberately hardcoded to light/print-safe colors (not
// the app's theme tokens) since this must stay legible on paper regardless
// of whether the dashboard is in dark mode when "Print Invoice" is clicked.

const INK = "#18140f";
const MUTED = "#6b6f7a";
const ACCENT = "#c2790b";
const BORDER = "#e2e0da";
const TINT_BG = "#eef1f7";

function LabelRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b pb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED, borderColor: BORDER }}>
      {children}
    </div>
  );
}

function HeaderMetaRow({ label, value, mutedValue = false }: { label: string; value: string; mutedValue?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: mutedValue ? MUTED : INK, fontWeight: mutedValue ? 400 : 700 }}>
        {value}
      </span>
    </div>
  );
}

export function InvoicePrintView({ order }: { order: OrderDetail }) {
  const { data: tenantSettingsData } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });
  const tenant = tenantSettingsData?.data;

  const isPickup = order.delivery_method === "pickup";
  const amountPaid = getTotalPaid(order.payments);
  const totalRefunded = getTotalRefunded(order.payments);
  // Item-level discounts plus any legacy order-level discount (see Order.js's
  // discount_amount comment) — order.subtotal already nets these out, so
  // Subtotal below adds them back to show the pre-discount figure, same
  // convention as the dashboard's order-detail page.
  const itemDiscount = order.items.reduce((sum, i) => sum + i.discount_amount, 0);
  const totalDiscount = itemDiscount + order.discount_amount;
  // See utils/paymentTotals.ts#getBalanceDue — correctly distinguishes "paid
  // in full, then refunded" (due $0) from "never paid in full, then refunded
  // on top of that" (due reflects the real remaining shortfall). The
  // Balance Outstanding banner further below relies on this already being
  // correct rather than separately suppressing itself for a refunded status.
  const amountDue = getBalanceDue(order.total, order.payments, order.status);
  const orderDate = new Date(order.created_at).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  // Rendered at print/PDF-build time, not stored — matches invoicePdf.js,
  // which stamps the same "as of right now" timestamp server-side.
  const printedAt = new Date().toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const billingAddress = order.billing_address ?? order.shipping_address;
  const channelLabel = order.channel === "ebay" ? "eBay" : order.channel === "manual" ? "In-Store" : "Storefront";

  return (
    <div
      className="flex min-h-[270mm] flex-col rounded-[10px] border p-7"
      style={{ borderColor: BORDER, color: INK, background: "#ffffff" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6" style={{ borderColor: BORDER }}>
        <div className="flex items-start gap-4">
          <TenantLogo logoUrl={tenant?.logo_url} name={tenant?.company_name} sizeClass="h-14" maxWidthClass="max-w-[60px]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">{tenant?.company_name || "—"}</h2>
            <div className="mt-1.5 text-xs" style={{ color: INK }}>
              {tenant?.pickup_location.address}
              {tenant?.pickup_location.address && tenant?.pickup_location.country ? ", " : ""}
              {tenant?.pickup_location.country}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: MUTED }}>
              <span className="font-semibold" style={{ color: INK }}>
                ABN:
              </span>{" "}
              {tenant?.abn || "—"} &nbsp;|&nbsp;{" "}
              <span className="font-semibold" style={{ color: INK }}>
                PH:
              </span>{" "}
              {tenant?.phone || "—"}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
              <span className="font-semibold" style={{ color: INK }}>
                EMAIL:
              </span>{" "}
              {tenant?.email || "—"}
            </div>
            <div className="mt-1.5 text-xs font-semibold" style={{ color: ACCENT }}>
              Official Tax Invoice
            </div>
          </div>
        </div>
        <div className="text-right" style={{ minWidth: 240 }}>
          <h1 className="text-3xl font-black uppercase tracking-tight">Tax Invoice</h1>
          <p className="mt-1 text-sm font-bold" style={{ color: ACCENT }}>
            {formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number)}
          </p>
          <div className="mt-3 space-y-1">
            <HeaderMetaRow label="Invoice Date:" value={orderDate} />
            <HeaderMetaRow label="Due Date:" value="Upon Receipt" />
            <HeaderMetaRow label="Printed:" value={printedAt} mutedValue />
          </div>
        </div>
      </div>

      <div className="grid gap-6 py-6 sm:grid-cols-3">
        <div>
          <LabelRule>Bill To</LabelRule>
          <div className="mt-2.5 text-sm font-bold">{order.customer.name}</div>
          <div className="mt-1.5 space-y-0.5 text-xs" style={{ color: MUTED }}>
            {billingAddress && <div>{billingAddress.address}</div>}
            {billingAddress && (
              <div>
                {billingAddress.suburb} {billingAddress.state} {billingAddress.postcode}, Australia
              </div>
            )}
            {order.customer.phone && <div>PH: {order.customer.phone}</div>}
            {order.customer.email && <div>EMAIL: {order.customer.email}</div>}
          </div>
        </div>

        <div>
          <LabelRule>Ship To</LabelRule>
          <div className="mt-2.5 text-sm font-bold">{order.customer.name}</div>
          <div className="mt-1.5 space-y-0.5 text-xs" style={{ color: MUTED }}>
            {isPickup || !order.shipping_address ? (
              <div>Collecting in-store — see seller address above.</div>
            ) : (
              <>
                <div>{order.shipping_address.address}</div>
                <div>
                  {order.shipping_address.suburb} {order.shipping_address.state} {order.shipping_address.postcode}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: TINT_BG }}>
          <LabelRule>Transaction</LabelRule>
          <div className="mt-2.5 text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>
            Order Number
          </div>
          <div className="text-sm font-bold">{formatOrderNumber(order.order_number_prefix, order.order_number)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: TINT_BG }}>
              <th className="w-10 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Description / Item Code
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Unit Price (ex GST)
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                GST (11%)
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Qty
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Discount
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Total (inc GST)
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => {
              // GST-inclusive AU retail pricing: extracted as total/11, never
              // added on top of unit_price — see utils/format.ts#getLineGst.
              const lineTotal = item.unit_price * item.quantity - item.discount_amount;
              const lineGst = getLineGst(lineTotal);
              return (
                <tr key={i} className="border-b last:border-b-0" style={{ borderColor: BORDER }}>
                  <td className="px-3 py-3 align-top text-xs" style={{ color: MUTED }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold">{item.name}</div>
                    {item.sku && (
                      <div className="mt-0.5 text-xs" style={{ color: MUTED }}>
                        Part SKU: {item.sku}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    {formatCurrencyFromCents(getExclusiveUnitPrice(item.unit_price))}
                  </td>
                  <td className="px-3 py-3 text-right align-top">{formatCurrencyFromCents(lineGst)}</td>
                  <td className="px-3 py-3 text-right align-top">{item.quantity}</td>
                  <td className="px-3 py-3 text-right align-top">{formatCurrencyFromCents(item.discount_amount)}</td>
                  <td className="px-3 py-3 text-right align-top font-semibold">{formatCurrencyFromCents(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-8 pt-8 sm:grid-cols-2">
        <div>
          <div className="rounded-lg p-4" style={{ background: TINT_BG }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              <Landmark className="h-3.5 w-3.5" />
              Bank Transfer Details
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>
                  Bank Name
                </div>
                <div className="font-semibold">{tenant?.bank_details.bank_name || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>
                  Account Name
                </div>
                <div className="font-semibold">{tenant?.bank_details.account_name || tenant?.company_name || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>
                  BSB
                </div>
                <div className="font-semibold">{tenant?.bank_details.bsb || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>
                  Account No
                </div>
                <div className="font-semibold">{tenant?.bank_details.account_number || "—"}</div>
              </div>
            </div>
          </div>
          {amountPaid > 0 ? (
            <div
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
              style={{ background: "#16a34a" }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Payment Received via {channelLabel}
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: MUTED }}>
              No payment recorded yet.
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>Subtotal</span>
            <span className="font-semibold">{formatCurrencyFromCents(order.subtotal + totalDiscount)}</span>
          </div>
          {/* Always shown, even at $0 — combines every line item's own
              discount with any legacy order-level discount. */}
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>Discount</span>
            <span className="font-semibold">
              {totalDiscount > 0 ? `-${formatCurrencyFromCents(totalDiscount)}` : formatCurrencyFromCents(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>{isPickup ? "Pickup" : "Freight / Shipping"}</span>
            <span className="font-semibold">{formatCurrencyFromCents(order.shipping_cost)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base" style={{ borderColor: BORDER }}>
            <span className="font-bold">Total</span>
            <span className="font-bold" style={{ color: ACCENT }}>
              {formatCurrencyFromCents(order.total)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>Total Paid</span>
            <span className="font-semibold">{formatCurrencyFromCents(amountPaid)}</span>
          </div>
          {totalRefunded > 0 && (
            <div className="flex justify-between">
              <span style={{ color: MUTED }}>Total Refunded</span>
              <span className="font-semibold">{formatCurrencyFromCents(totalRefunded)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>Total Due</span>
            <span className="font-semibold">{formatCurrencyFromCents(amountDue)}</span>
          </div>

          {/* Every channel can carry an outstanding balance now that
              storefront/eBay prices can be edited post-payment — not just
              manual sales, so this is no longer gated on order.channel.
              Only rendered when there's an actual balance (amountDue > 0) —
              getBalanceDue already correctly returns 0 for an order that was
              paid in full before being refunded, so no separate refunded-
              status check is needed here (and one would incorrectly hide a
              real balance on an order that was never paid in full and later
              had a partial refund on top of that). */}
          {amountDue > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg px-4 py-3" style={{ background: ACCENT }}>
              <span className="text-xs font-bold uppercase tracking-wider text-white">Balance Outstanding</span>
              <span className="text-sm font-bold text-white">{formatCurrencyFromCents(amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-auto grid gap-6 rounded-lg p-5 text-xs sm:grid-cols-2"
        style={{ background: TINT_BG, color: MUTED }}
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: INK }}>
            Warranty &amp; Returns
          </div>
          <p className="mt-1.5 leading-relaxed">{tenant?.warranty_text || "—"}</p>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: INK }}>
            Legal Disclaimer
          </div>
          <p className="mt-1.5 leading-relaxed">{tenant?.legal_disclaimer_text || "—"}</p>
        </div>
      </div>
    </div>
  );
}
