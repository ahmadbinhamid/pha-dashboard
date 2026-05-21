const _currencyFmts = new Map<string, Intl.NumberFormat>();
const _compactFmt = new Intl.NumberFormat("en-AU", { notation: "compact" });

export function formatCurrency(amount: number, currency: string = "AUD") {
  let fmt = _currencyFmts.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 });
    _currencyFmts.set(currency, fmt);
  }
  return fmt.format(amount);
}

export function formatCompactNumber(n: number) {
  return _compactFmt.format(n);
}
