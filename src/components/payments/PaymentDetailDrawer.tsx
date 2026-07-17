import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { RefundDialog } from "@/components/payments/RefundDialog";
import { getPayment } from "@/lib/api/payments";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Refund, RefundStatus } from "@/types/payment";
import { REFUND_REASON_LABEL } from "@/config/refundReasons";

interface PaymentDetailDrawerProps {
  paymentId: string;
  onClose: () => void;
}

const REFUND_STATUS_VARIANT: Record<RefundStatus, "ok" | "warn" | "danger"> = {
  succeeded: "ok",
  pending: "warn",
  failed: "danger",
};

export function PaymentDetailDrawer({ paymentId, onClose }: PaymentDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [refunding, setRefunding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => getPayment(paymentId),
  });

  const payment = data?.data;
  const order = payment && typeof payment.order === "object" ? payment.order : null;
  const remaining = payment ? payment.amount - payment.amount_refunded : 0;
  const canRefund = payment?.status === "succeeded" && remaining > 0;

  function handleRefunded() {
    queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    setRefunding(false);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-dvh w-[min(100vw,520px)] flex-col border-l border-border bg-bg shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-sm font-semibold">Payment Details</div>
            <div className="mt-0.5 text-xs text-fg/50">{order?.order_number ?? "—"}</div>
          </div>
          <button type="button" onClick={onClose} className="text-fg/40 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading || !payment ? (
            <div className="py-8 text-center text-sm text-fg/50">Loading payment…</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-bg-2/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-semibold text-fg">{formatCurrencyFromCents(payment.amount)}</span>
                  <PaymentStatusBadge status={payment.status} />
                </div>
                {payment.amount_refunded > 0 && (
                  <div className="mt-1 text-xs text-fg/55">
                    {formatCurrencyFromCents(payment.amount_refunded)} refunded
                  </div>
                )}
                <div className="mt-3 space-y-1 text-xs text-fg/60">
                  <div className="flex justify-between">
                    <span>Customer</span>
                    <span className="text-fg">{order?.customer.name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email</span>
                    <span className="text-fg">{order?.customer.email ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Card</span>
                    <span className="text-fg">
                      {payment.card_brand ? `${payment.card_brand} •••• ${payment.card_last4}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid At</span>
                    <span className="text-fg">
                      {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "—"}
                    </span>
                  </div>
                  {payment.failure_reason && (
                    <div className="flex justify-between">
                      <span>Failure Reason</span>
                      <span className="text-danger">{payment.failure_reason}</span>
                    </div>
                  )}
                </div>
              </div>

              {canRefund && (
                <Button variant="secondary" size="sm" className="w-full gap-2" onClick={() => setRefunding(true)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Refund Payment
                </Button>
              )}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Refund History</div>
                {payment.refunds.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-fg/45">
                    No refunds yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payment.refunds.map((refund: Refund) => (
                      <div key={refund._id} className="rounded-lg border border-border bg-bg-2/40 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-fg">{formatCurrencyFromCents(refund.amount)}</span>
                          <Badge variant={REFUND_STATUS_VARIANT[refund.status]}>{refund.status}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-fg/55">
                          {REFUND_REASON_LABEL[refund.reason] ?? refund.reason}
                          {refund.initiated_via === "stripe_dashboard" && " — via Stripe Dashboard"}
                        </div>
                        {refund.failure_reason && (
                          <div className="mt-1 text-xs text-danger">{refund.failure_reason}</div>
                        )}
                        <div className="mt-1.5 text-[10px] text-fg/40">
                          {new Date(refund.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {refunding && payment && (
        <RefundDialog payment={payment} onClose={() => setRefunding(false)} onSuccess={handleRefunded} />
      )}
    </div>
  );
}
