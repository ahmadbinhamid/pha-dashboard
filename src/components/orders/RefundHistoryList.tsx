import { Badge } from "@/components/ui/Badge";
import { REFUND_REASON_LABEL } from "@/config/refundReasons";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Refund, RefundStatus } from "@/types/payment";

const REFUND_STATUS_VARIANT: Record<RefundStatus, "ok" | "warn" | "danger"> = {
  succeeded: "ok",
  pending: "warn",
  failed: "danger",
};

export function RefundHistoryList({ refunds }: { refunds: Refund[] }) {
  if (refunds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-fg/45">
        No refunds yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {refunds.map((refund) => (
        <div key={refund._id} className="rounded-lg border border-border bg-bg-2/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">{formatCurrencyFromCents(refund.amount)}</span>
            <Badge variant={REFUND_STATUS_VARIANT[refund.status]}>{refund.status}</Badge>
          </div>
          <div className="mt-1 text-xs text-fg/55">
            {REFUND_REASON_LABEL[refund.reason] ?? refund.reason}
            {refund.initiated_via === "stripe_dashboard" && " — via Stripe Dashboard"}
          </div>
          {refund.failure_reason && <div className="mt-1 text-xs text-danger">{refund.failure_reason}</div>}
          <div className="mt-1.5 text-[10px] text-fg/40">{new Date(refund.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
