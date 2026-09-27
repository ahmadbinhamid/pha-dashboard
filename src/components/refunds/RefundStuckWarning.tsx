import { formatCurrencyFromCents } from "@/utils/format";
import type { StuckRefund } from "@/types/refund";

interface RefundStuckWarningProps {
  stuckRefunds: StuckRefund[];
}

// A refund stuck in pending/processing long enough falls out of max_refundable's accounting (refund.service.js#getReservingRefunds' age bound), so a dropped webhook can't lock out refunds forever — but the numbers here can look off unless surfaced. refund.reconciliation.service.js resolves these within minutes; informational only.
export function RefundStuckWarning({ stuckRefunds }: RefundStuckWarningProps) {
  if (stuckRefunds.length === 0) return null;

  return (
    <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
      <div className="font-medium">
        {stuckRefunds.length === 1 ? "A refund is" : `${stuckRefunds.length} refunds are`} taking longer than usual to
        confirm
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {stuckRefunds.map((r) => (
          <li key={r.refund_number}>
            {r.refund_number} — {formatCurrencyFromCents(r.total_amount)} ({r.status}
            {r.still_reserved ? ", still held against this order" : ", no longer counted above"})
          </li>
        ))}
      </ul>
    </div>
  );
}
