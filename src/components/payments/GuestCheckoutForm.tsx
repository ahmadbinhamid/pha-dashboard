import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";

// BYOK: each tenant has their own Stripe publishable key (stripe.payment.service.js#createPaymentIntentForOrder), returned alongside client_secret rather than a build-time env var. Cached per key so re-rendering doesn't re-init Stripe.js.
const stripeInstances = new Map<string, ReturnType<typeof loadStripe>>();
function getStripeForKey(publishableKey: string) {
  if (!stripeInstances.has(publishableKey)) {
    stripeInstances.set(publishableKey, loadStripe(publishableKey));
  }
  return stripeInstances.get(publishableKey)!;
}

export function GuestCheckoutForm({ clientSecret, publishableKey }: { clientSecret: string; publishableKey: string }) {
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);
  const stripePromise = useMemo(() => getStripeForKey(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={options}>
      <GuestPaymentForm />
    </Elements>
  );
}

function GuestPaymentForm() {
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
