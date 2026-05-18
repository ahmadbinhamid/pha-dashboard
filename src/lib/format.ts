export function formatCurrency(amount: number, currency: string = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactNumber(n: number) {
  return new Intl.NumberFormat("en-AU", { notation: "compact" }).format(n);
}

