import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context";
import { generatePaymentLink } from "@/lib/api/orders";
import { formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";
import type { Order } from "@/types/orders";

interface OrderConfirmationStepProps {
  order: Order;
  onStartNewOrder: () => void;
}

export function OrderConfirmationStep({ order, onStartNewOrder }: OrderConfirmationStepProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  // Only a pending-payment manual order can still need a link generated —
  // once paid (in full or via a succeeded Stripe session), there's nothing left to collect.
  const canGenerateLink = order.channel === "manual" && order.status === "pending_payment";

  const generateLinkMutation = useMutation({
    mutationFn: () => generatePaymentLink(order._id),
    onSuccess: (res) => {
      setPaymentLink(res.data.url);
      toast({ title: "Payment link generated", tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't generate payment link", description: err.message, tone: "danger" });
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

      {canGenerateLink && (
        <Card>
          <CardHeader title="Payment Link" description="Generate a Stripe-hosted link for the customer to pay online" />
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
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full gap-2"
                disabled={generateLinkMutation.isPending}
                onClick={() => generateLinkMutation.mutate()}
              >
                <LinkIcon className="h-4 w-4" />
                {generateLinkMutation.isPending ? "Generating…" : "Generate Payment Link"}
              </Button>
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
