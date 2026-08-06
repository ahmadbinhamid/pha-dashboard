import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Send } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context";
import { sendPaymentLinkEmail } from "@/lib/api/orders";
import { formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";
import type { Order } from "@/types/orders";
import type { OrderPaymentChoice } from "@/types/payment";

interface OrderConfirmationStepProps {
  order: Order;
  paymentMethod: OrderPaymentChoice | "";
  onStartNewOrder: () => void;
}

export function OrderConfirmationStep({ order, paymentMethod, onStartNewOrder }: OrderConfirmationStepProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  // Only shown when staff explicitly chose "Payment Link (Stripe)" at
  // checkout for a still-unpaid manual order — ties the button to the actual
  // method chosen, not just any unpaid manual order (see
  // order.service.js#createManualOrder — no other signal on the order itself
  // records which method was picked when nothing was collected).
  const canSendPaymentLink =
    order.channel === "manual" && order.payment_status === "pending_payment" && paymentMethod === "payment_link";
  const hasCustomerEmail = !!order.customer.email;

  const sendLinkMutation = useMutation({
    mutationFn: () => sendPaymentLinkEmail(order._id),
    onSuccess: (res) => {
      setPaymentLink(res.data.url);
      toast({ title: `Payment link emailed to ${order.customer.email}`, tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't send payment link", description: err.message, tone: "danger" });
    },
  });

  function copyLink() {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink).then(
      () => toast({ title: "Copied to clipboard", tone: "success" }),
      () => toast({ title: "Couldn't copy link", tone: "danger" }),
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--ok))]/10">
            <CheckCircle2 className="h-7 w-7 text-[hsl(var(--ok))]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-fg">Order {formatOrderNumber(order.order_number_prefix, order.order_number)} created</h2>
            <p className="mt-1 text-sm text-fg/55">{formatCurrencyFromCents(order.total)} total for {order.customer.name}</p>
          </div>
        </CardContent>
      </Card>

      {canSendPaymentLink && (
        <Card>
          <CardHeader title="Payment Link" description="Email the customer a Stripe-hosted link to pay online" />
          <CardContent className="space-y-3">
            {paymentLink ? (
              <div className="flex items-center gap-2">
                <Input value={paymentLink} readOnly size="sm" className="flex-1" />
                <Button type="button" variant="secondary" size="icon" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="secondary" size="icon" asChild>
                  <a href={paymentLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full gap-2"
                  disabled={sendLinkMutation.isPending || !hasCustomerEmail}
                  onClick={() => sendLinkMutation.mutate()}
                >
                  <Send className="h-4 w-4" />
                  {sendLinkMutation.isPending ? "Sending…" : "Send Payment Link"}
                </Button>
                {!hasCustomerEmail && (
                  <p className="text-xs text-danger">Add a customer email to send a payment link.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-2">
        <Button variant="secondary" size="md" onClick={onStartNewOrder}>
          Create Another Order
        </Button>
        <Button variant="primary" size="md" onClick={() => navigate(`/orders/${order._id}`)}>
          View Order
        </Button>
      </div>
    </div>
  );
}
