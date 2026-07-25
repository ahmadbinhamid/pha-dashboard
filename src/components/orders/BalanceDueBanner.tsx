import { formatCurrencyFromCents } from "@/utils/format";

export function BalanceDueBanner({ amount }: { amount: number }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--warn))]/30 bg-[hsl(var(--warn))]/10 px-3 py-2 text-sm font-semibold text-[hsl(var(--warn))]">
      Balance Due: {formatCurrencyFromCents(amount)}
    </div>
  );
}
