import { Building2, MapPin, Mail } from "lucide-react";
import { PartsHubLogoImage } from "@/components/branding/PartsHubLogoImage";
import { COMPANY_INFO, PICKUP_LOCATION, INVOICE_NOTE } from "@/config/company";
import { formatCurrencyFromCents } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { OrderDetail } from "@/types/orders";

// Print-only invoice, structured to match the tax-invoice PDF attached to
// the pickup-ready/shipped emails (order.service.js#sendOrderNotification)
// — same sections, same fields — so a printed copy and the emailed copy
// never disagree. Deliberately hardcoded to light/print-safe colors (not
// the app's theme tokens) since this must stay legible on paper regardless
// of whether the dashboard is in dark mode when "Print Invoice" is clicked.

const INK = "#1f1a14";
const MUTED = "#7b7065";
const ACCENT = "#c39113";
const BORDER = "#d8d4ca";
const TABLE_HEAD_BG = "#f6f3ec";

function DetailLine({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: MUTED }} />
      <span>{children}</span>
    </div>
  );
}

export function InvoicePrintView({ order }: { order: OrderDetail }) {
  const isPickup = order.delivery_method === "pickup";
  const isPaid = order.status !== "pending_payment";
  const orderDate = new Date(order.created_at).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-[10px] border p-7" style={{ borderColor: BORDER, color: INK, background: "#ffffff" }}>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6" style={{ borderColor: BORDER }}>
        <div className="flex items-start gap-4">
          <PartsHubLogoImage sizeClass="h-12" maxWidthClass="max-w-[52px]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">INVOICE #{order.order_number}</h1>
            <p className="mt-1.5 text-xs uppercase tracking-wide" style={{ color: MUTED }}>
              Order Date: {orderDate}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
              isPaid ? "border-emerald-500 text-emerald-600" : "border-amber-500 text-amber-600",
            )}
          >
            {isPaid ? "Paid & Secured" : "Pending Payment"}
          </span>
          <p className="mt-2 text-xs uppercase tracking-wide" style={{ color: MUTED }}>
            Channel: {order.channel === "ebay" ? "eBay" : "Storefront"}
          </p>
        </div>
      </div>

      <div className="grid gap-8 border-b py-6 sm:grid-cols-2" style={{ borderColor: BORDER }}>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            Seller Profile
          </div>
          <div className="mt-2 text-sm font-bold">{COMPANY_INFO.name}</div>
          <div className="mt-2 space-y-1.5 text-sm" style={{ color: MUTED }}>
            <DetailLine icon={Building2}>ABN {COMPANY_INFO.abn}</DetailLine>
            <DetailLine icon={MapPin}>
              {PICKUP_LOCATION.address}, {PICKUP_LOCATION.country}
            </DetailLine>
            <DetailLine icon={Mail}>{COMPANY_INFO.email}</DetailLine>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            {isPickup ? "Customer Details" : "Billing & Delivery Address"}
          </div>
          <div className="mt-2 text-sm font-bold">{order.customer.name}</div>
          <div className="mt-2 space-y-1.5 text-sm" style={{ color: MUTED }}>
            {isPickup || !order.shipping_address ? (
              <>
                <DetailLine icon={Mail}>{order.customer.email}</DetailLine>
                <DetailLine icon={MapPin}>Collecting in-store — see seller address above.</DetailLine>
              </>
            ) : (
              <>
                <DetailLine icon={MapPin}>
                  {order.shipping_address.address}, {order.shipping_address.suburb} {order.shipping_address.state}{" "}
                  {order.shipping_address.postcode}, Australia
                </DetailLine>
                <DetailLine icon={Mail}>{order.customer.email}</DetailLine>
                {order.billing_address && (
                  <div className="text-xs">
                    Billing: {order.billing_address.address}, {order.billing_address.suburb}{" "}
                    {order.billing_address.state} {order.billing_address.postcode}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: TABLE_HEAD_BG }}>
            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              Item Spec &amp; Part SKU
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              Qty
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              Unit Price
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
              Total Price
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-b" style={{ borderColor: BORDER }}>
              <td className="px-3 py-3">
                <div className="font-semibold">{item.name}</div>
                {item.sku && (
                  <div className="text-xs" style={{ color: ACCENT }}>
                    {item.sku}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-right">{item.quantity}</td>
              <td className="px-3 py-3 text-right">{formatCurrencyFromCents(item.unit_price)}</td>
              <td className="px-3 py-3 text-right">{formatCurrencyFromCents(item.unit_price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-8 pt-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
            Payment Information
          </div>
          <div className="mt-2 text-sm">
            {order.payment ? (
              <>
                <div>
                  {order.payment.card_brand
                    ? `${order.payment.card_brand.charAt(0).toUpperCase()}${order.payment.card_brand.slice(1)} Ending in ${order.payment.card_last4}`
                    : "Card"}
                </div>
                <div className="text-xs" style={{ color: MUTED }}>
                  Processed via Secure Gateway
                </div>
              </>
            ) : (
              <div style={{ color: MUTED }}>No payment recorded yet.</div>
            )}
          </div>
          <p className="mt-3 text-xs italic" style={{ color: MUTED }}>
            &quot;{INVOICE_NOTE}&quot;
          </p>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>Subtotal (incl. GST)</span>
            <span className="font-semibold">{formatCurrencyFromCents(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>GST Included</span>
            <span className="font-semibold">{formatCurrencyFromCents(order.tax_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: MUTED }}>{isPickup ? "Pickup" : "Shipping"}</span>
            <span className="font-semibold">{formatCurrencyFromCents(order.shipping_cost)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base" style={{ borderColor: BORDER }}>
            <span className="font-bold" style={{ color: ACCENT }}>
              Total Amount
            </span>
            <span className="font-bold" style={{ color: ACCENT }}>
              {formatCurrencyFromCents(order.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
