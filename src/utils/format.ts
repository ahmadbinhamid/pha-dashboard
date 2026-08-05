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

// Payment/Refund amounts are stored as integer cents in the backend —
// unlike Product.price, which is dollars. Keep the cents/dollars boundary
// explicit rather than dividing by 100 ad hoc at each call site.
export function formatCurrencyFromCents(cents: number, currency: string = "AUD") {
  return formatCurrency(cents / 100, currency);
}

// GST-inclusive AU retail pricing: GST component of a (post-discount) line
// total is extracted as total/11, never added on top — same convention as
// the backend's order.service.js#GST_DIVISOR, applied per-line here since
// order.tax_amount is only ever an order-level figure.
export function getLineGst(lineTotalCents: number) {
  return Math.round(lineTotalCents / 11);
}

// Same GST-inclusive convention as getLineGst, applied to a single unit's
// inclusive price to get its GST-exclusive counterpart for display.
export function getExclusiveUnitPrice(unitPriceCents: number) {
  return unitPriceCents - getLineGst(unitPriceCents);
}

// Order.order_number/invoice_number are stored as just the zero-padded
// sequence ("00001") — no prefix baked in. The prefix comes from the
// order's OWN order_number_prefix/invoice_number_prefix (snapshotted at
// creation time from TenantSettings — see types/orders.ts), never a
// hardcoded literal and never a live lookup of the tenant's CURRENT
// setting, which would retroactively relabel every past order the moment
// that setting changes. Backend-rendered outputs the frontend never
// touches (the PDF invoice, transactional emails) use the equivalent
// server/src/utils/orderNumberFormat.js instead.
export function formatOrderNumber(prefix: string, raw: string) {
  return `${prefix}-${raw}`;
}

export function formatInvoiceNumber(prefix: string, raw: string) {
  return `${prefix}-${raw}`;
}
