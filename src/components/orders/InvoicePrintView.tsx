import { useQuery } from "@tanstack/react-query";
import { TenantLogo } from "@/components/branding/TenantLogo";
import { InvoiceRichText } from "@/components/orders/InvoiceRichText";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import {
  formatCurrencyFromCents,
  getExclusiveUnitPrice,
  getLineGst,
  formatInvoiceNumber,
  stripEbayAddressPrefix,
} from "@/utils/format";
import { getTotalPaid, getBalanceDue, getTotalRefunded } from "@/utils/paymentTotals";
import type { OrderDetail } from "@/types/orders";

// Print-only invoice, structured to match the tax-invoice PDF attached to
// the pickup-ready/shipped emails (order.service.js#sendOrderNotification)
// — same sections, same fields, same visual language — so a printed copy
// and the emailed copy never disagree. Deliberately hardcoded to
// light/print-safe colors (not the app's theme tokens) since this must stay
// legible on paper regardless of whether the dashboard is in dark mode when
// "Print Invoice" is clicked. (This is also why the badges/rules below are
// hand-styled rather than the shared <Badge>/<Card> components, which pull
// in theme-aware tokens.)
//
// Layout language (kept in lockstep with invoicePdf.js): a heavy rule under
// the letterhead, a divided meta strip for the four transaction facts, Ship
// To / Bill To pushed to opposite edges, a hairline-ruled items table, and a
// solid ink bar for the grand total. Data values are set in a monospace face
// so figures, dates and reference numbers align column-to-column; names and
// headings stay in the sans face.

const INK = "#18140f";
const MUTED = "#6b6f7a";
const ACCENT = "#c2790b";
const BORDER = "#e2e0da";
const GREEN = "#15803d";

// Small-caps, wide-tracked section label in the accent color — "SHIP TO",
// "PAYMENT DETAILS", "WARRANTY & RETURNS".
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8.5px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
      {children}
    </div>
  );
}

// One cell of the header meta strip (Invoice Date / Due Date / Order Number
// / Sales Channel) — divided from its neighbour by a hairline rule rather
// than sitting in its own bordered box.
function MetaCell({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={first ? "" : "border-l pl-5"} style={first ? undefined : { borderColor: BORDER }}>
      <div className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[12px]" style={{ color: INK }}>
        {value}
      </div>
    </div>
  );
}

// Tiny caps label above a monospace value — the bank-details grid's four
// fields.
function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-[10.5px]" style={{ color: INK }}>
        {value}
      </div>
    </div>
  );
}

// One line of the totals ledger. `tone` picks the emphasis: plain ink for a
// running figure, accent for a deduction, green for a settled balance.
function TotalRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "green" }) {
  const color = tone === "accent" ? ACCENT : tone === "green" ? GREEN : INK;
  return (
    <div className="flex items-baseline justify-between gap-4 py-[5px]">
      <span className="font-mono text-[11px]" style={{ color: tone === "default" ? MUTED : color }}>
        {label}
      </span>
      <span className="whitespace-nowrap font-mono text-[11px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// A table cell's right-aligned monospace figure — every numeric column.
function Figure({ children, bold, color = INK }: { children: React.ReactNode; bold?: boolean; color?: string }) {
  return (
    <span className={`font-mono text-[11px] ${bold ? "font-bold" : ""}`} style={{ color }}>
      {children}
    </span>
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
  // discount_amount comment) — order.subtotal already nets these out.
  const itemDiscount = order.items.reduce((sum, i) => sum + i.discount_amount, 0);
  const totalDiscount = itemDiscount + order.discount_amount;
  // order.tax_amount is the authoritative GST embedded in order.subtotal
  // (computed once at order-creation time from the POST-discount subtotal —
  // order.service.js#GST_DIVISOR) — reused directly, matching
  // invoicePdf.js's identical convention, so the emailed/downloaded PDF and
  // this on-screen preview can never disagree about GST.
  const gstAmount = order.tax_amount;
  const exGstSubtotal = order.subtotal - gstAmount;
  // See utils/paymentTotals.ts#getBalanceDue — correctly distinguishes "paid
  // in full, then refunded" (due $0) from "never paid in full, then refunded
  // on top of that" (due reflects the real remaining shortfall).
  const amountDue = getBalanceDue(order.total, order.payments, order.payment_status);
  const orderDate = new Date(order.created_at).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const billingAddress = order.billing_address ?? order.shipping_address;
  const channelLabel = order.channel === "ebay" ? "eBay" : order.channel === "manual" ? "In-Store" : "Storefront";
  // "Order Number" is the customer's OWN reference, typed on the order detail
  // page — optional, and omitted from the strip entirely when it's blank
  // rather than falling back to our internal ORD-000xx (the invoice already
  // carries its own number, so printing a second house number under a label
  // the buyer reads as "yours" just looked like their PO had been ignored).
  const invoiceNumberValue = formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number);
  // Company name takes over the customer's name slot on the invoice when set.
  const displayName = order.customer.company_name || order.customer.name;
  const sellerAddress = [tenant?.pickup_location.address, tenant?.pickup_location.country].filter(Boolean).join(", ");
  // Phone / email / ABN collapse onto one letterhead line, separated by
  // middots — only the parts the tenant has actually filled in.
  const sellerContactLine = [tenant?.phone, tenant?.email, tenant?.abn ? `ABN ${tenant.abn}` : null]
    .filter(Boolean)
    .join(" · ");

  const metaCells = [
    { label: "Invoice Date", value: orderDate },
    { label: "Due Date", value: "Upon receipt" },
    ...(order.reference_number ? [{ label: "Order Number", value: order.reference_number }] : []),
    { label: "Sales Channel", value: channelLabel },
  ];

  return (
    <div
      // Stays a flex column when printing (unlike the shell containers in
      // AppShell.tsx, which switch to print:block) — that's what keeps the
      // mt-auto footer pinned to the foot of the sheet on paper, not just on
      // screen.
      //
      // globals.css pins @page to `margin: 0; size: A4`, so the printable
      // area is the full 210×297mm sheet and this padding IS the page
      // margin. min-h is one page less a 1mm rounding cushion: a normal
      // invoice then fills exactly one page with the footer on its bottom
      // edge, and a longer one flows onto further pages with the footer
      // after the last of it.
      className="flex min-h-[296mm] flex-col p-10"
      style={{ color: INK, background: "#ffffff" }}
    >
      {/* Letterhead — seller identity left, document identity right. Never
          wraps: the invoice number belongs on the same line as the company
          name, hard against the right edge, however long the name runs. */}
      <div className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-start gap-3">
          <TenantLogo logoUrl={tenant?.logo_url} name={tenant?.company_name} sizeClass="h-[44px]" maxWidthClass="max-w-[44px]" />
          <div>
            <h2 className="text-[16px] font-black uppercase leading-none tracking-tight">{tenant?.company_name || "—"}</h2>
            <div className="mt-1 font-mono text-[10px]" style={{ color: INK }}>
              {sellerAddress || "—"}
            </div>
            <div className="mt-0.5 font-mono text-[10px]" style={{ color: MUTED }}>
              {sellerContactLine}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
            Tax Invoice
          </div>
          <div className="mt-1.5 font-mono text-[21px] font-black leading-none tracking-tight">{invoiceNumberValue}</div>
        </div>
      </div>

      {/* Heavy rule closing the letterhead, then the four transaction facts. */}
      <div className="mt-5 border-t-[3px]" style={{ borderColor: INK }} />
      <div
        className={`grid gap-5 border-b py-3.5 ${metaCells.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
        style={{ borderColor: BORDER }}
      >
        {metaCells.map((cell, i) => (
          <MetaCell key={cell.label} label={cell.label} value={cell.value} first={i === 0} />
        ))}
      </div>

      {/* Ship To / Bill To pushed to opposite edges of the sheet. */}
      <div className="flex flex-wrap items-start justify-between gap-10 py-6">
        <div className="max-w-[46%]">
          <SectionLabel>Ship To</SectionLabel>
          <div className="mt-2 text-[12.5px] font-black uppercase leading-tight tracking-tight">{displayName}</div>
          <div className="mt-2 space-y-0.5 font-mono text-[10px] leading-relaxed" style={{ color: MUTED }}>
            {isPickup || !order.shipping_address ? (
              <div>Collecting in-store, see seller address above.</div>
            ) : (
              <>
                <div>{stripEbayAddressPrefix(order.shipping_address.address)}</div>
                <div>
                  {order.shipping_address.suburb} {order.shipping_address.state} {order.shipping_address.postcode}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="max-w-[46%] text-right">
          <SectionLabel>Bill To</SectionLabel>
          <div className="mt-2 text-[12.5px] font-black uppercase leading-tight tracking-tight">{displayName}</div>
          <div className="mt-2 space-y-0.5 font-mono text-[10px] leading-relaxed" style={{ color: MUTED }}>
            {billingAddress && <div>{stripEbayAddressPrefix(billingAddress.address)}</div>}
            {billingAddress && (
              <div>
                {billingAddress.suburb} {billingAddress.state} {billingAddress.postcode}, Australia
              </div>
            )}
            {order.customer.phone && <div>PH: {order.customer.phone}</div>}
            {order.customer.email && <div>EMAIL: {order.customer.email}</div>}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse">
        {/* table-header-group repeats this row on every printed page the
            table spans, so a row that lands on page 2 isn't unlabeled. */}
        <thead style={{ display: "table-header-group" }}>
          <tr className="text-[8.5px] font-bold uppercase tracking-[0.1em]" style={{ color: MUTED }}>
            <th className="w-9 border-t border-b-2 py-2.5 text-left whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              #
            </th>
            <th className="border-t border-b-2 py-2.5 pr-4 text-left whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              Description / Item Code
            </th>
            <th className="border-t border-b-2 py-2.5 pr-4 text-right whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              Unit ex GST
            </th>
            <th className="border-t border-b-2 py-2.5 pr-4 text-right whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              GST 11%
            </th>
            <th className="border-t border-b-2 py-2.5 pr-4 text-right whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              Qty
            </th>
            <th className="border-t border-b-2 py-2.5 pr-4 text-right whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              Discount
            </th>
            <th className="border-t border-b-2 py-2.5 text-right whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              Total inc GST
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
              <tr
                key={i}
                className="border-b"
                // Without this, the browser's print pagination can slice a
                // row in half across a page boundary (reported: a long
                // item name got cut off mid-line). pageBreakInside is the
                // older alias some print engines still need alongside the
                // standard breakInside property.
                style={{ borderColor: BORDER, breakInside: "avoid", pageBreakInside: "avoid" }}
              >
                <td className="py-3 align-top">
                  <Figure color={MUTED}>{String(i + 1).padStart(2, "0")}</Figure>
                </td>
                <td className="py-3 pr-4 align-top">
                  <div className="text-[13px] font-bold leading-snug">{item.name}</div>
                  {item.sku && (
                    <div className="mt-1 font-mono text-[9.5px]" style={{ color: MUTED }}>
                      SKU {item.sku}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4 text-right align-top">
                  <Figure>{formatCurrencyFromCents(getExclusiveUnitPrice(item.unit_price))}</Figure>
                </td>
                <td className="py-3 pr-4 text-right align-top">
                  <Figure>{formatCurrencyFromCents(lineGst)}</Figure>
                </td>
                <td className="py-3 pr-4 text-right align-top">
                  <Figure>{item.quantity}</Figure>
                </td>
                <td className="py-3 pr-4 text-right align-top">
                  {item.discount_amount > 0 ? (
                    <Figure color={ACCENT}>−{formatCurrencyFromCents(item.discount_amount)}</Figure>
                  ) : (
                    <Figure color={MUTED}>{formatCurrencyFromCents(0)}</Figure>
                  )}
                </td>
                <td className="py-3 text-right align-top">
                  <Figure bold>{formatCurrencyFromCents(lineTotal)}</Figure>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-start justify-between gap-10 pt-6 print:block">
        <div
          className="flex-1 print:inline-block print:w-[56%] print:align-top"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
          <SectionLabel>Payment Details</SectionLabel>
          <div className="mt-3 grid max-w-[420px] grid-cols-2 gap-x-6 gap-y-3.5">
            <FieldBlock label="Bank Name" value={tenant?.bank_details.bank_name || "—"} />
            <FieldBlock label="Account Name" value={tenant?.bank_details.account_name || tenant?.company_name || "—"} />
            <FieldBlock label="BSB" value={tenant?.bank_details.bsb || "—"} />
            <FieldBlock label="Account No" value={tenant?.bank_details.account_number || "—"} />
          </div>

          <div className="mt-4 max-w-[420px] border-t pt-3.5 font-mono text-[10px] leading-relaxed" style={{ borderColor: BORDER, color: MUTED }}>
            {amountPaid > 0
              ? `Payment received via ${channelLabel}. No further action required, quote ${invoiceNumberValue} for any enquiry about this order.`
              : `No payment recorded yet, quote ${invoiceNumberValue} when settling this invoice.`}
          </div>

          {/* Outlined status stamp: the settled/unsettled state of the
              invoice, and the channel it was taken through. */}
          <div
            className="mt-4 inline-flex items-baseline gap-2.5 rounded-sm border px-3.5 py-2"
            style={{ borderColor: amountPaid > 0 ? GREEN : ACCENT }}
          >
            <span className="text-[15px] font-black uppercase tracking-tight" style={{ color: amountPaid > 0 ? GREEN : ACCENT }}>
              {amountPaid > 0 ? "Paid" : "Unpaid"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: MUTED }}>
              {channelLabel}
            </span>
          </div>
        </div>

        <div
          className="w-[270px] print:inline-block print:w-[40%] print:ml-[4%] print:align-top"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
          {/* Pre-discount subtotal + the discount itself only earn a line
              when there actually is a discount — an order with none goes
              straight from Subtotal (ex GST) to GST to Pickup/Freight,
              matching a clean invoice with nothing to net out. */}
          {totalDiscount > 0 && (
            <>
              <TotalRow label="Subtotal" value={formatCurrencyFromCents(order.subtotal + totalDiscount)} />
              <TotalRow label="Discount" value={`−${formatCurrencyFromCents(totalDiscount)}`} tone="accent" />
            </>
          )}
          <TotalRow label="Subtotal (ex GST)" value={formatCurrencyFromCents(exGstSubtotal)} />
          <TotalRow label="GST (11%)" value={formatCurrencyFromCents(gstAmount)} />
          <TotalRow label={isPickup ? "Pickup" : "Freight"} value={formatCurrencyFromCents(order.shipping_cost)} />

          <div className="mt-3 flex items-center justify-between gap-4 px-4 py-3.5" style={{ background: INK }}>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white">Total inc GST</span>
            <span className="whitespace-nowrap font-mono text-[13px] font-black" style={{ color: "#e0a83a" }}>
              {formatCurrencyFromCents(order.total)}
            </span>
          </div>

          <div className="mt-3">
            <TotalRow label="Total paid" value={formatCurrencyFromCents(amountPaid)} />
            {totalRefunded > 0 && <TotalRow label="Total refunded" value={formatCurrencyFromCents(totalRefunded)} />}
            <TotalRow
              label="Total due"
              value={formatCurrencyFromCents(amountDue)}
              tone={amountDue === 0 ? "green" : "accent"}
            />
          </div>

          {/* Every channel can carry an outstanding balance now that
              storefront/eBay prices can be edited post-payment — not just
              manual sales, so this is no longer gated on order.channel.
              Only rendered when there's an actual balance (amountDue > 0) —
              getBalanceDue already correctly returns 0 for an order that was
              paid in full before being refunded, so no separate refunded-
              status check is needed here. */}
          {amountDue > 0 && (
            <div className="mt-3 flex items-center justify-between gap-4 px-4 py-3" style={{ background: ACCENT }}>
              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                Balance Outstanding
              </span>
              <span className="whitespace-nowrap font-mono text-[13px] font-bold text-white">
                {formatCurrencyFromCents(amountDue)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        // Pinned to the bottom of the sheet, on screen and on paper alike —
        // see the sheet's own comment for why it stays a flex column when
        // printing. pt-8 keeps a minimum gap from the content above on an
        // invoice long enough to have consumed the slack.
        className="mt-auto pt-8"
      >
        <div
          // print:block + inline-block columns, instead of keeping this a
          // CSS grid at print time — see each column's own breakInside
          // comment for why that guard lives on the column, not this wrapper.
          className="grid grid-cols-2 gap-10 border-t pt-5 print:block"
          style={{ borderColor: BORDER }}
        >
          <div
            className="print:inline-block print:w-[48%] print:align-top"
            // Keeps this column's own content from splitting mid-sentence
            // across a page boundary (reported: "...returns." got orphaned
            // alone on its own page).
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <SectionLabel>Warranty &amp; Returns</SectionLabel>
            <InvoiceRichText
              value={tenant?.warranty_text}
              className="mt-2 font-mono text-[9.5px] leading-relaxed"
              style={{ color: MUTED }}
            />
          </div>
          <div
            className="print:inline-block print:w-[48%] print:ml-[4%] print:align-top"
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <SectionLabel>Legal Disclaimer</SectionLabel>
            <InvoiceRichText
              value={tenant?.legal_disclaimer_text}
              className="mt-2 font-mono text-[9.5px] leading-relaxed"
              style={{ color: MUTED }}
            />
          </div>
        </div>

        {/* Closing rule under the footer columns — the sheet's bottom edge. */}
        <div className="mt-5 border-t" style={{ borderColor: BORDER }} />
      </div>
    </div>
  );
}
