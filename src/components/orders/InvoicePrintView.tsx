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

// Print invoice mirroring invoicePdf.js; fixed print colours ignore dark mode.

const INK = "#000000";
const ACCENT = "#c2790b";
const BORDER = "#e2e0da";
const GREEN = "#15803d";

// Small-caps, wide-tracked section label (e.g. "SHIP TO").
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8.5px] font-bold uppercase tracking-[0.16em]">
      {children}
    </div>
  );
}

// One header meta cell, hairline-divided from its neighbour.
function MetaCell({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={first ? "" : "border-l pl-5"} style={first ? undefined : { borderColor: BORDER }}>
      <div className="text-[8px] font-bold uppercase tracking-[0.12em]">
        {label}
      </div>
      <div className="mt-1.5 text-[12px]">
        {value}
      </div>
    </div>
  );
}

// Caps label over a value, for the bank-details grid.
function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-[0.12em]">
        {label}
      </div>
      <div className="mt-1 text-[10.5px]">
        {value}
      </div>
    </div>
  );
}

// One totals-ledger line: label left, figure right.
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[5px]">
      <span className="text-[11px]">{label}</span>
      <span className="whitespace-nowrap text-[11px] tabular-nums">{value}</span>
    </div>
  );
}

// A table cell's right-aligned figure, for every numeric column.
function Figure({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <span className={`text-[11px] tabular-nums ${bold ? "font-bold" : ""}`}>
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
  // Includes legacy order-level discount; order.subtotal already nets it out.
  const itemDiscount = order.items.reduce((sum, i) => sum + i.discount_amount, 0);
  const totalDiscount = itemDiscount + order.discount_amount;
  // order.tax_amount is the authoritative GST, same as invoicePdf.js.
  const gstAmount = order.tax_amount;
  const exGstSubtotal = order.subtotal - gstAmount;
  // Paid-then-refunded is $0 due, not a shortfall (getBalanceDue).
  const amountDue = getBalanceDue(order.total, order.payments, order.payment_status);
  const orderDate = new Date(order.created_at).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  // NOTE: no billing address entered means no Bill To; contact moves to Ship To.
  const billingAddress = order.billing_address;
  const contactLines = [
    order.customer.phone ? `Phone: ${order.customer.phone}` : null,
    order.customer.email ? `Email: ${order.customer.email}` : null,
  ].filter(Boolean);
  const channelLabel = order.channel === "ebay" ? "eBay" : order.channel === "manual" ? "In-Store" : "Storefront";
  // Customer's own reference; omitted when blank, never our internal number.
  const invoiceNumberValue = formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number);
  // Company name takes over the customer's name slot on the invoice when set.
  const displayName = order.customer.company_name || order.customer.name;
  const sellerAddress = [tenant?.pickup_location.address, tenant?.pickup_location.country].filter(Boolean).join(", ");
  // Address, email, phone and ABN each on their own line, filled ones only.
  const sellerLines = [sellerAddress || "—", tenant?.email, tenant?.phone, tenant?.abn ? `ABN ${tenant.abn}` : null].filter(
    Boolean,
  );

  const metaCells = [
    { label: "Invoice Date", value: orderDate },
    { label: "Due Date", value: "Due on receipt" },
    ...(order.reference_number ? [{ label: "Order Number", value: order.reference_number }] : []),
    { label: "Sales Channel", value: channelLabel },
  ];

  return (
    <div
      // Flex column in print keeps the mt-auto footer at the A4 page foot.
      className="flex min-h-[296mm] flex-col p-10"
      style={{ color: INK, background: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Letterhead never wraps: invoice number stays beside the company name. */}
      <div className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-start gap-3">
          <TenantLogo logoUrl={tenant?.logo_url} name={tenant?.company_name} sizeClass="h-[44px]" maxWidthClass="max-w-[44px]" />
          <div>
            <h2 className="text-[16px] font-black uppercase leading-none tracking-tight">{tenant?.company_name || "—"}</h2>
            <div className="mt-1 space-y-0.5 text-[10px]">
              {sellerLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] font-bold uppercase tracking-[0.28em]">
            Tax Invoice
          </div>
          <div className="mt-1.5 text-[21px] font-black leading-none tracking-tight">{invoiceNumberValue}</div>
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

      {/* Bill To left (when present), Ship To always in the right column. */}
      <div className="flex flex-wrap items-start justify-between gap-10 py-6">
        {billingAddress && (
          <div className="max-w-[46%]">
            <SectionLabel>Bill To</SectionLabel>
            <div className="mt-2 text-[12.5px] font-black uppercase leading-tight tracking-tight">{displayName}</div>
            <div className="mt-2 space-y-0.5 text-[10px] leading-relaxed">
              <div>{stripEbayAddressPrefix(billingAddress.address)}</div>
              <div>
                {billingAddress.suburb} {billingAddress.state} {billingAddress.postcode}, Australia
              </div>
              {contactLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto w-[46%]">
          <SectionLabel>Ship To</SectionLabel>
          <div className="mt-2 text-[12.5px] font-black uppercase leading-tight tracking-tight">{displayName}</div>
          <div className="mt-2 space-y-0.5 text-[10px] leading-relaxed">
            {isPickup || !order.shipping_address ? (
              <div>Customer collection from the store address above.</div>
            ) : (
              <>
                <div>{stripEbayAddressPrefix(order.shipping_address.address)}</div>
                <div>
                  {order.shipping_address.suburb} {order.shipping_address.state} {order.shipping_address.postcode}
                </div>
              </>
            )}
            {!billingAddress && contactLines.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse">
        {/* table-header-group repeats this row on every printed page. */}
        <thead style={{ display: "table-header-group" }}>
          <tr className="text-[8.5px] font-bold uppercase tracking-[0.1em]">
            <th className="w-9 border-t border-b-2 py-2.5 text-left whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              #
            </th>
            <th className="border-t border-b-2 py-2.5 pr-4 text-left whitespace-nowrap" style={{ borderTopColor: BORDER, borderBottomColor: INK }}>
              Description
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
            // GST-inclusive pricing: GST is total/11, never added on top.
            const lineTotal = item.unit_price * item.quantity - item.discount_amount;
            const lineGst = getLineGst(lineTotal);
            return (
              <tr
                key={i}
                className="border-b"
                // Stops print pagination slicing a row; pageBreakInside for old engines.
                style={{ borderColor: BORDER, breakInside: "avoid", pageBreakInside: "avoid" }}
              >
                <td className="py-3 align-top">
                  <Figure>{String(i + 1).padStart(2, "0")}</Figure>
                </td>
                <td className="py-3 pr-4 align-top">
                  <div className="text-[13px] font-normal leading-snug">
                    {item.name}
                    {item.sku && ` (SKU: ${item.sku})`}
                  </div>
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
                    <Figure>−{formatCurrencyFromCents(item.discount_amount)}</Figure>
                  ) : (
                    <Figure>{formatCurrencyFromCents(0)}</Figure>
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


          {/* Status stamp: paid/unpaid plus the sales channel. */}
          <div
            className="mt-4 inline-flex items-baseline gap-2.5 rounded-sm border px-3.5 py-2"
            style={{ borderColor: amountPaid > 0 ? GREEN : ACCENT }}
          >
            <span className="text-[15px] font-black uppercase tracking-tight">
              {amountPaid > 0 ? "Paid" : "Unpaid"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.1em]">
              {channelLabel}
            </span>
          </div>
        </div>

        <div
          className="w-[270px] print:inline-block print:w-[40%] print:ml-[4%] print:align-top"
          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        >
          {/* Pre-discount subtotal and discount lines only when discounted. */}
          {totalDiscount > 0 && (
            <>
              <TotalRow label="Subtotal" value={formatCurrencyFromCents(order.subtotal + totalDiscount)} />
              <TotalRow label="Discount" value={`−${formatCurrencyFromCents(totalDiscount)}`} />
            </>
          )}
          <TotalRow label="Subtotal (ex GST)" value={formatCurrencyFromCents(exGstSubtotal)} />
          <TotalRow label="GST (11%)" value={formatCurrencyFromCents(gstAmount)} />
          <TotalRow label={isPickup ? "Pickup" : "Freight"} value={formatCurrencyFromCents(order.shipping_cost)} />

          <div className="mt-3 flex items-center justify-between gap-4 px-4 py-3.5" style={{ background: INK }}>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white">Total inc GST</span>
            <span className="whitespace-nowrap text-[13px] font-black" style={{ color: "#e0a83a" }}>
              {formatCurrencyFromCents(order.total)}
            </span>
          </div>

          <div className="mt-3">
            <TotalRow label="Total paid" value={formatCurrencyFromCents(amountPaid)} />
            {totalRefunded > 0 && <TotalRow label="Total refunded" value={formatCurrencyFromCents(totalRefunded)} />}
            <TotalRow label="Total due" value={formatCurrencyFromCents(amountDue)} />
          </div>

          {/* Any channel can owe a balance, since prices can change post-payment. */}
          {amountDue > 0 && (
            <div className="mt-3 flex items-center justify-between gap-4 px-4 py-3" style={{ background: ACCENT }}>
              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                Balance Outstanding
              </span>
              <span className="whitespace-nowrap text-[13px] font-bold text-white">
                {formatCurrencyFromCents(amountDue)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        // mt-auto pins the footer to the sheet foot; pt-8 is the minimum gap.
        className="mt-auto pt-8"
      >
        <div
          // Inline-block columns in print so each can avoid breaking inside itself.
          className="grid grid-cols-2 gap-10 border-t pt-5 print:block"
          style={{ borderColor: BORDER }}
        >
          <div
            className="print:inline-block print:w-[48%] print:align-top"
            // Keeps the column from splitting across a page boundary.
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <SectionLabel>Warranty &amp; Returns</SectionLabel>
            <InvoiceRichText
              value={tenant?.warranty_text}
              className="mt-2 text-[9.5px] leading-relaxed"
            />
          </div>
          <div
            className="print:inline-block print:w-[48%] print:ml-[4%] print:align-top"
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <SectionLabel>Legal Disclaimer</SectionLabel>
            <InvoiceRichText
              value={tenant?.legal_disclaimer_text}
              className="mt-2 text-[9.5px] leading-relaxed"
            />
          </div>
        </div>

        {/* Closing rule under the footer columns — the sheet's bottom edge. */}
        <div className="mt-5 border-t" style={{ borderColor: BORDER }} />
      </div>
    </div>
  );
}
