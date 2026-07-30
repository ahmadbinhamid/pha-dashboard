import { formatCurrencyFromCents } from "@/utils/format";
import type { StuckRefund } from "@/types/refund";

interface RefundStuckWarningProps {
  stuckRefunds: StuckRefund[];
}

// Corrections round — a refund can sit in pending/processing long enough
// that getRefundableSummary's max_refundable figure stops accounting for it
// (see refund.service.js#getReservingRefunds' age bound). That's necessary
// so a dropped webhook can't lock out further refunds forever, but it means
// the numbers on THIS screen can look like they don't add up unless this is
// surfaced explicitly — refund.reconciliation.service.js resolves these
// automatically within minutes; this is informational, not something to act
// on immediately.
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
