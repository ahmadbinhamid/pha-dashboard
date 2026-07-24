import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { useToast } from "@/context";
import { generatePaymentLink } from "@/lib/api/orders";
import { formatCurrencyFromCents } from "@/utils/format";
import { REFUND_REASON_LABEL } from "@/config/refundReasons";
import { PAYMENT_METHOD_LABEL } from "@/config/paymentMethods";
import type { OrderChannel, OrderStatus, OrderPaymentSummary } from "@/types/orders";
import type { Refund, RefundStatus } from "@/types/payment";

function GeneratePaymentLink({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => generatePaymentLink(orderId),
    onSuccess: (res) => setLink(res.data.url),
    onError: (err: Error) => {
      toast({ title: "Couldn't generate payment link", description: err.message, tone: "danger" });
    },
  });

  if (link) {
    return (
      <div className="flex items-center gap-1.5">
        <Input value={link} readOnly size="sm" className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => navigator.clipboard.writeText(link).then(() => toast({ title: "Copied", tone: "success" }))}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="secondary" size="icon" asChild>
          <a href={link} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="w-full gap-2"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <LinkIcon className="h-3.5 w-3.5" />
      {mutation.isPending ? "Generating…" : "Generate Payment Link"}
    </Button>
  );
}

const REFUND_STATUS_VARIANT: Record<RefundStatus, "ok" | "warn" | "danger"> = {
  succeeded: "ok",
  pending: "warn",
  failed: "danger",
};

function BalanceDueBanner({ amount }: { amount: number }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--warn))]/30 bg-[hsl(var(--warn))]/10 px-3 py-2 text-sm font-semibold text-[hsl(var(--warn))]">
      Balance Due: {formatCurrencyFromCents(amount)}
    </div>
  );
}

export function OrderPaymentSummaryCard({
  orderId,
  orderStatus,
  payment,
  refunds,
  total,
  channel,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  payment: OrderPaymentSummary | null;
  refunds: Refund[];
  total: number;
  channel: OrderChannel;
}) {
  const isManual = channel === "manual";
  // A payment link only makes sense while there's still something to
  // collect — a succeeded payment or a non-manual order never shows it.
  const canGenerateLink = isManual && orderStatus === "pending_payment";

  // Manual orders can be created with nothing collected yet (invoice left
  // fully outstanding) — there's no Payment doc to show in that case, but
  // staff still need to see exactly what's owed, not just a blank state.
  if (!payment) {
    if (isManual) {
      return (
        <div className="space-y-3">
          <BalanceDueBanner amount={total} />
          <p className="text-xs text-fg/50">No payment has been collected for this order yet.</p>
          {canGenerateLink && <GeneratePaymentLink orderId={orderId} />}
        </div>
      );
    }
    return <div className="py-6 text-center text-sm text-fg/50">No payment recorded for this order yet.</div>;
  }

  // Net of any refund, clamped so a data inconsistency (e.g. a refund
  // exceeding what was actually collected) can never render a negative
  // "balance due" — the worst case is showing the full total as due.
  const netPaid = Math.max(0, payment.amount - payment.amount_refunded);
  const amountDue = isManual ? Math.max(0, total - netPaid) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-semibold text-fg">{formatCurrencyFromCents(payment.amount)}</span>
        <PaymentStatusBadge status={payment.status} />
      </div>
      {payment.amount_refunded > 0 && (
        <div className="text-xs text-fg/55">{formatCurrencyFromCents(payment.amount_refunded)} refunded</div>
      )}

      {isManual && amountDue > 0 && <BalanceDueBanner amount={amountDue} />}
      {isManual && amountDue > 0 && canGenerateLink && payment.provider !== "stripe" && (
        <GeneratePaymentLink orderId={orderId} />
      )}

      <div className="space-y-1 text-xs text-fg/60">
        {isManual ? (
          <>
            <div className="flex justify-between">
              <span>Payment Method</span>
              <span className="text-fg">
                {payment.payment_method ? PAYMENT_METHOD_LABEL[payment.payment_method] : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Order Total</span>
              <span className="text-fg">{formatCurrencyFromCents(total)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span>Card</span>
            <span className="text-fg">
              {payment.card_brand ? `${payment.card_brand} •••• ${payment.card_last4}` : "—"}
            </span>
          </div>
        )}
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
