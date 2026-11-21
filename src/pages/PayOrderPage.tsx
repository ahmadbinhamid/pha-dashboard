import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { GuestCheckoutForm } from "@/components/payments/GuestCheckoutForm";
import { getGuestOrder, createGuestPaymentIntent } from "@/lib/api/guestPayment";
import { formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";
import type { GuestOrder } from "@/types/orders";

// Query params Stripe appends when a redirect method returns here.
const STRIPE_RETURN_PARAMS = ["payment_intent", "payment_intent_client_secret", "redirect_status"];
const CONFIRM_POLL_MS = 3000;

function isOrderPaid(order: GuestOrder | undefined) {
  if (!order) return false;
  return order.payment_status === "paid" || order.fulfillment_status === "completed" || order.amount_due <= 0;
}

// Only a 404 means a dead link; no status means the request never got through.
function payLinkErrorMessage(error: unknown) {
  const status = (error as { status?: number } | null | undefined)?.status;

  if (status === 404) {
    return "We couldn't find this order — the link may be invalid or expired.";
  }
  if (status === undefined) {
    return "We couldn't reach the payment service. Please check your connection and try again.";
  }
  return "Something went wrong loading this order. Please try again, or contact the seller.";
}

export default function PayOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // Read once: the params are stripped below so a retry starts clean.
  const [redirectStatus] = useState(() => searchParams.get("redirect_status"));
  const returnedApproved = redirectStatus === "succeeded" || redirectStatus === "processing";

  useEffect(() => {
    if (!STRIPE_RETURN_PARAMS.some((key) => searchParams.has(key))) return;
    const next = new URLSearchParams(searchParams);
    STRIPE_RETURN_PARAMS.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["guest-order", orderId, token],
    queryFn: () => getGuestOrder(orderId!, token),
    enabled: !!orderId && !!token,
    retry: false,
    // Webhook marks the order paid shortly after the provider redirect.
    refetchInterval: (query) =>
      returnedApproved && !isOrderPaid(query.state.data?.data) ? CONFIRM_POLL_MS : false,
  });
  const order = data?.data;

  const intentMutation = useMutation({
    mutationFn: () => createGuestPaymentIntent(orderId!, token),
  });

  const reloadOrder = () => {
    intentMutation.reset();
    void refetch();
  };

  if (!orderId || !token) {
    return <StatusShell message="This payment link is missing required information." />;
  }

  if (isLoading) {
    return (
      <StatusShell>
        <SkeletonText lines={3} />
      </StatusShell>
    );
  }

  if (error || !order) {
    return <StatusShell message={payLinkErrorMessage(error)} />;
  }

  // Server value: order.payment is the latest attempt, possibly a cancelled one.
  const amountDue = order.amount_due;
  const alreadyPaid = isOrderPaid(order);

  return (
    <StatusShell>
      <Card>
        <CardHeader
          title={`Order ${formatOrderNumber(order.order_number_prefix, order.order_number)}`}
          description={alreadyPaid ? "This order has already been paid." : `Amount due: ${formatCurrencyFromCents(amountDue, order.currency)}`}
        />
        <CardContent>
          {alreadyPaid ? (
            <p className="text-sm text-fg/65">Nothing further to pay — thank you.</p>
          ) : returnedApproved ? (
            <p className="text-sm text-ok">Payment received — confirming your order…</p>
          ) : intentMutation.data ? (
            <GuestCheckoutForm
              clientSecret={intentMutation.data.data.client_secret}
              publishableKey={intentMutation.data.data.stripe_publishable_key}
              onOrderChanged={reloadOrder}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {redirectStatus === "failed" && (
                <p className="text-xs font-medium text-danger">
                  Your payment wasn't approved. Please try again or choose another method.
                </p>
              )}
              <Button onClick={() => intentMutation.mutate()} disabled={intentMutation.isPending}>
                {intentMutation.isPending ? "Preparing payment…" : "Pay now"}
              </Button>
              {intentMutation.isError && (
                <p className="text-xs font-medium text-danger">
                  {(intentMutation.error as Error)?.message || "Failed to start payment"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </StatusShell>
  );
}

function StatusShell({ message, children }: { message?: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        {message ? (
          <Card>
            <CardContent>
              <p className="text-sm text-fg/65">{message}</p>
            </CardContent>
          </Card>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
