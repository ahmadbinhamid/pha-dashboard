import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/utils/cn";

const pad = (n: number) => String(n).padStart(2, "0");

/** "ENDS IN: 04D 18H 32M", renders nothing for a sale with no end. */
export function SaleCountdown({ endsAt, className }: { endsAt: string | null; className?: string }) {
  const left = useCountdown(endsAt);
  if (!left) return null;
  return (
    <span className={cn("font-bold tabular-nums tracking-wide uppercase", className)}>
      {left.expired ? "Sale ended" : `Ends in: ${pad(left.days)}D ${pad(left.hours)}H ${pad(left.minutes)}M`}
    </span>
  );
}
