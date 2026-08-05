import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getGuestOrder, createGuestPaymentIntent } from "@/lib/api/guestPayment";
import { formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";

// BYOK — this page is shared across every tenant's admin-generated "payment
// link" orders, and each tenant now has their own Stripe account/publishable
// key (see stripe.payment.service.js#createPaymentIntentForOrder), returned
// alongside the client_secret rather than read from a single build-time env
// var. Cached per publishable key so re-rendering doesn't re-init Stripe.js.
const stripeInstances = new Map<string, ReturnType<typeof loadStripe>>();
function getStripeForKey(publishableKey: string) {
  if (!stripeInstances.has(publishableKey)) {
    stripeInstances.set(publishableKey, loadStripe(publishableKey));
  }
  return stripeInstances.get(publishableKey)!;
}

// Shared, platform-hosted payment page — one page for every tenant's
// admin-generated "payment link" orders (see stripe.payment.service.js#createPaymentLinkForOrder).
// No login, no tenant branding: just enough to show what's owed and collect
// a card payment. Security is the guest `token` in the URL, not a session.
export default function PayOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["guest-order", orderId, token],
    queryFn: () => getGuestOrder(orderId!, token),
    enabled: !!orderId && !!token,
    retry: false,
  });
  const order = data?.data;

  const intentMutation = useMutation({
    mutationFn: () => createGuestPaymentIntent(orderId!, token),
  });

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
    return <StatusShell message="We couldn't find this order — the link may be invalid or expired." />;
  }

  const amountDue = order.total - (order.payment?.amount ?? 0);
  const alreadyPaid = order.status === "paid" || order.status === "fulfilled" || amountDue <= 0;

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
          ) : intentMutation.data ? (
            <CheckoutForm
              clientSecret={intentMutation.data.data.client_secret}
              publishableKey={intentMutation.data.data.stripe_publishable_key}
            />
          ) : (
            <div className="flex flex-col gap-3">
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

function CheckoutForm({ clientSecret, publishableKey }: { clientSecret: string; publishableKey: string }) {
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);
  const stripePromise = useMemo(() => getStripeForKey(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm />
    </Elements>
  );
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message || "Payment failed — please try again.");
    } else {
      setSucceeded(true);
    }
  };

  if (succeeded) {
    return <p className="text-sm text-ok">Payment received — thank you.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && <p className="text-xs font-medium text-danger">{errorMessage}</p>}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? "Processing…" : "Pay"}
      </Button>
    </form>
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
