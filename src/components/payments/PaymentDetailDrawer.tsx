import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { RefundDialog } from "@/components/refunds/RefundDialog";
import { RefundHistoryList } from "@/components/refunds/RefundHistoryList";
import { getPayment } from "@/lib/api/payments";
import { formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";
import { getPaymentSourceLabel, getPaymentMethodDisplay } from "@/utils/paymentDisplay";

interface PaymentDetailDrawerProps {
  paymentId: string;
  onClose: () => void;
}

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
  // refund-redesign-spec.md §7 — one refund action regardless of settlement
  // method now (the dialog auto-detects Stripe vs manual per payment
  // allocation, and can even span more than just this one payment).
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
            <div className="mt-0.5 text-xs text-fg/50">{order ? formatOrderNumber(order.order_number_prefix, order.order_number) : "—"}</div>
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
                    <span>{getPaymentSourceLabel(payment)}</span>
                    <span className="text-fg">{getPaymentMethodDisplay(payment)}</span>
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

              {canRefund && order && (
                <Button variant="secondary" size="sm" className="w-full gap-2" onClick={() => setRefunding(true)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Issue Refund
                </Button>
              )}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Refund History</div>
                {/* This payment's own refund attributions — a refund spanning
                    several payments on the order shows fully on the Order
                    Detail page's Refund History instead, which is
                    order-scoped rather than filtered to one payment. */}
                <RefundHistoryList orderId={order?._id ?? ""} refunds={payment.refunds} />
              </div>
            </div>
          )}
        </div>
      </div>

      {order && (
        <RefundDialog orderId={order._id} open={refunding} onOpenChange={setRefunding} onSuccess={handleRefunded} />
      )}
    </div>
  );
}
