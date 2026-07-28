import { ChevronRight } from "lucide-react";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { PAYMENT_METHOD_LABEL } from "@/config/paymentMethods";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderPaymentSummary } from "@/types/orders";

// Every Payment doc recorded against an order — a manual sale can have more
// than one (a deposit, then a later top-up or payment-link remainder), so
// this always renders a history rather than assuming a single payment.
export function PaymentHistoryList({
  payments,
  onSelect,
}: {
  payments: OrderPaymentSummary[];
  onSelect?: (paymentId: string) => void;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-fg/45">
        No payments recorded for this order yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <div
          key={payment._id}
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onClick={onSelect ? () => onSelect(payment._id) : undefined}
          className={
            "rounded-lg border border-border bg-bg-2/40 p-3" +
            (onSelect ? " cursor-pointer transition hover:border-fg/20 hover:bg-bg-2/70" : "")
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">{formatCurrencyFromCents(payment.amount)}</span>
            <div className="flex items-center gap-2">
              <PaymentStatusBadge status={payment.status} />
              {onSelect && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg/30" />}
            </div>
          </div>
          <div className="mt-1 text-xs text-fg/55">
            {payment.provider === "manual"
              ? payment.payment_method
                ? PAYMENT_METHOD_LABEL[payment.payment_method]
                : "Manual"
              : payment.card_brand
                ? `${payment.card_brand.charAt(0).toUpperCase()}${payment.card_brand.slice(1)} •••• ${payment.card_last4}`
                : "Card"}
          </div>
          {payment.amount_refunded > 0 && (
            <div className="mt-1 text-xs text-fg/55">{formatCurrencyFromCents(payment.amount_refunded)} refunded</div>
          )}
          <div className="mt-1.5 text-[10px] text-fg/40">
            {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "Not yet paid"}
          </div>
        </div>
      ))}
    </div>
  );
}
