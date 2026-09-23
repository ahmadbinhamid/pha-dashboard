const _currencyFmts = new Map<string, Intl.NumberFormat>();
const _compactFmt = new Intl.NumberFormat("en-AU", { notation: "compact" });

export function formatCurrency(amount: number, currency: string = "AUD") {
  let fmt = _currencyFmts.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 });
    _currencyFmts.set(currency, fmt);
  }
  return fmt.format(amount);
}

export function formatCompactNumber(n: number) {
  return _compactFmt.format(n);
}

// Payment/Refund amounts are integer cents on the backend, unlike Product.price (dollars) — keep the boundary explicit rather than dividing by 100 ad hoc.
export function formatCurrencyFromCents(cents: number, currency: string = "AUD") {
  return formatCurrency(cents / 100, currency);
}

// GST-inclusive AU pricing: GST is extracted as total/11, never added on top — same convention as order.service.js#GST_DIVISOR, applied per-line since order.tax_amount is order-level only.
export function getLineGst(lineTotalCents: number) {
  return Math.round(lineTotalCents / 11);
}

// Same GST-inclusive convention as getLineGst, applied to a unit's inclusive price to get its GST-exclusive counterpart for display.
export function getExclusiveUnitPrice(unitPriceCents: number) {
  return unitPriceCents - getLineGst(unitPriceCents);
}

// order_number/invoice_number store just the zero-padded sequence ("00001") — the prefix comes from the order's own snapshotted prefix (types/orders.ts), never a live tenant-setting lookup that would retroactively relabel past orders. Backend outputs use the equivalent server/src/utils/orderNumberFormat.js.
export function formatOrderNumber(prefix: string, raw: string) {
  return `${prefix}-${raw}`;
}

export function formatInvoiceNumber(prefix: string, raw: string) {
  return `${prefix}-${raw}`;
}

// eBay orders store the buyer's masked identifier as an "ebay:<code>, " prefix on address line 1 — meaningless on a customer-facing invoice. Strips it when present, a no-op otherwise, so it's safe unconditionally. Backend PDFs use server/src/utils/addressFormat.js.
export function stripEbayAddressPrefix(address: string) {
  return address.replace(/^ebay:[^,]*,\s*/i, "");
}

// Relative time ("5m ago", "2h ago"), falling back to a date.
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU");
}
