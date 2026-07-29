import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GeneratePaymentLink } from "@/components/orders/GeneratePaymentLink";
import { RecordPaymentModal } from "@/components/orders/RecordPaymentModal";
import { PaymentHistoryList } from "@/components/orders/PaymentHistoryList";
import { RefundHistoryList } from "@/components/orders/RefundHistoryList";
import { BalanceDueBanner } from "@/components/orders/BalanceDueBanner";
import { PaymentDetailDrawer } from "@/components/payments/PaymentDetailDrawer";
import { getTotalPaid, getBalanceDue } from "@/utils/paymentTotals";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderChannel, OrderStatus, OrderPaymentSummary } from "@/types/orders";
import type { Refund } from "@/types/payment";

export function OrderPaymentSummaryCard({
  orderId,
  orderStatus,
  payments,
  refunds,
  total,
  channel,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  payments: OrderPaymentSummary[];
  refunds: Refund[];
  total: number;
  channel: OrderChannel;
}) {
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const isManual = channel === "manual";
  const hasOutstandingBalance = orderStatus === "pending_payment" || orderStatus === "partially_paid";
  // Collecting more only ever applies to manual/in-store sales — storefront
  // and eBay orders are always settled in full by Stripe/the marketplace
  // before they reach this card.
  const canCollectMore = isManual && hasOutstandingBalance;

  if (payments.length === 0 && !isManual) {
    return <div className="py-6 text-center text-sm text-fg/50">No payment recorded for this order yet.</div>;
  }

  const totalPaid = getTotalPaid(payments);
  const balanceDue = getBalanceDue(total, payments, orderStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-fg">{formatCurrencyFromCents(totalPaid)}</span>
        <span className="text-xs text-fg/50">of {formatCurrencyFromCents(total)}</span>
      </div>

      {/* Gated on hasOutstandingBalance (not just balanceDue > 0) so a refund
          never gets mistaken for money still owed — refunding a paid order
          moves orderStatus to refunded/partially_refunded, which leaves the
          same arithmetic remainder as an uncollected balance but means the
          opposite thing. */}
      {isManual && hasOutstandingBalance && balanceDue > 0 && <BalanceDueBanner amount={balanceDue} />}

      {canCollectMore && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full gap-2"
            onClick={() => setRecordPaymentOpen(true)}
          >
            Record Payment
          </Button>
          <GeneratePaymentLink orderId={orderId} />
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Payment History</div>
        <PaymentHistoryList payments={payments} onSelect={setSelectedPaymentId} />
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Refund History</div>
        <RefundHistoryList refunds={refunds} />
      </div>

      <RecordPaymentModal
        orderId={orderId}
        balanceDueCents={balanceDue}
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
      />

      {selectedPaymentId && (
        <PaymentDetailDrawer paymentId={selectedPaymentId} onClose={() => setSelectedPaymentId(null)} />
      )}
    </div>
  );
}
