import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { formatCurrencyFromCents } from "@/utils/format";
import { REFUND_REASON_LABEL } from "@/config/refundReasons";
import type { OrderPaymentSummary } from "@/types/orders";
import type { Refund, RefundStatus } from "@/types/payment";

const REFUND_STATUS_VARIANT: Record<RefundStatus, "ok" | "warn" | "danger"> = {
  succeeded: "ok",
  pending: "warn",
  failed: "danger",
};

export function OrderPaymentSummaryCard({
  payment,
  refunds,
}: {
  payment: OrderPaymentSummary | null;
  refunds: Refund[];
}) {
  if (!payment) {
    return <div className="py-6 text-center text-sm text-fg/50">No payment recorded for this order yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-semibold text-fg">{formatCurrencyFromCents(payment.amount)}</span>
        <PaymentStatusBadge status={payment.status} />
      </div>
      {payment.amount_refunded > 0 && (
        <div className="text-xs text-fg/55">{formatCurrencyFromCents(payment.amount_refunded)} refunded</div>
      )}

      <div className="space-y-1 text-xs text-fg/60">
        <div className="flex justify-between">
          <span>Card</span>
          <span className="text-fg">
            {payment.card_brand ? `${payment.card_brand} •••• ${payment.card_last4}` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Paid At</span>
          <span className="text-fg">{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "—"}</span>
        </div>
      </div>

      <Link
        to="/payments"
        className="inline-flex items-center gap-1 text-xs font-medium text-accent transition hover:opacity-80"
      >
        View in Payments
        <ArrowRight className="h-3 w-3" />
      </Link>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Refund History</div>
        {refunds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-fg/45">
            No refunds yet
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
