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

// Payment/refund amounts are integer cents; Product.price is dollars.
export function formatCurrencyFromCents(cents: number, currency: string = "AUD") {
  return formatCurrency(cents / 100, currency);
}

// GST-inclusive AU pricing: GST is total/11, never added on top.
export function getLineGst(lineTotalCents: number) {
  return Math.round(lineTotalCents / 11);
}

// GST-exclusive unit price, same inclusive convention as getLineGst.
export function getExclusiveUnitPrice(unitPriceCents: number) {
  return unitPriceCents - getLineGst(unitPriceCents);
}

// Prefix comes from the order's own snapshot, so past orders never relabel.
export function formatOrderNumber(prefix: string, raw: string) {
  return `${prefix}-${raw}`;
}

export function formatInvoiceNumber(prefix: string, raw: string) {
  return `${prefix}-${raw}`;
}

// Drops eBay's masked-buyer "ebay:<code>, " prefix from address line 1.
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

/** "1 tag" / "3 tags"; for regular plurals only. */
export function pluralize(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** 1 -> "1st", 22 -> "22nd", 13 -> "13th". */
export function formatOrdinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
