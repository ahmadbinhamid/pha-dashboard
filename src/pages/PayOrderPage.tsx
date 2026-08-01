import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getGuestOrder, createGuestPaymentIntent } from "@/lib/api/guestPayment";
import { formatCurrencyFromCents } from "@/utils/format";

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// A PaymentIntent created on a tenant's Stripe Connect account can only be
// confirmed by a Stripe.js instance initialized IN that account's context —
// the publishable key alone isn't enough. Cached per account id so switching
// between orders from different tenants (in principle; this page is shared)
// doesn't re-instantiate Stripe.js unnecessarily.
const stripeInstances = new Map<string, ReturnType<typeof loadStripe>>();
function getStripeForAccount(stripeAccountId: string) {
  if (!PUBLISHABLE_KEY) return null;
  if (!stripeInstances.has(stripeAccountId)) {
    stripeInstances.set(stripeAccountId, loadStripe(PUBLISHABLE_KEY, { stripeAccount: stripeAccountId }));
  }
  return stripeInstances.get(stripeAccountId)!;
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
          title={`Order ${order.order_number}`}
          description={alreadyPaid ? "This order has already been paid." : `Amount due: ${formatCurrencyFromCents(amountDue, order.currency)}`}
        />
        <CardContent>
          {alreadyPaid ? (
            <p className="text-sm text-fg/65">Nothing further to pay — thank you.</p>
          ) : !PUBLISHABLE_KEY ? (
            <p className="text-sm text-danger">Payments are not configured for this page.</p>
          ) : intentMutation.data ? (
            <CheckoutForm
              clientSecret={intentMutation.data.data.client_secret}
              stripeAccountId={intentMutation.data.data.stripe_account_id}
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

function CheckoutForm({ clientSecret, stripeAccountId }: { clientSecret: string; stripeAccountId: string }) {
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);
  const stripePromise = useMemo(() => getStripeForAccount(stripeAccountId), [stripeAccountId]);
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
