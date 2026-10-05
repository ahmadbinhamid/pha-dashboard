import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";
import { isCancelledIntentError } from "@/lib/payments/stripeErrors";
import { ORDER_CHANGED_DURING_PAYMENT_MESSAGE } from "@/config/orderEdit";

// Per-tenant publishable key; cached so re-renders don't re-init Stripe.js.
const stripeInstances = new Map<string, ReturnType<typeof loadStripe>>();
function getStripeForKey(publishableKey: string) {
  if (!stripeInstances.has(publishableKey)) {
    stripeInstances.set(publishableKey, loadStripe(publishableKey));
  }
  return stripeInstances.get(publishableKey)!;
}

interface GuestCheckoutFormProps {
  clientSecret: string;
  publishableKey: string;
  // Refetches the order; the intent here no longer matches its total.
  onOrderChanged: () => void;
}

export function GuestCheckoutForm({ clientSecret, publishableKey, onOrderChanged }: GuestCheckoutFormProps) {
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);
  const stripePromise = useMemo(() => getStripeForKey(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={options}>
      <GuestPaymentForm onOrderChanged={onOrderChanged} />
    </Elements>
  );
}

function GuestPaymentForm({ onOrderChanged }: Pick<GuestCheckoutFormProps, "onOrderChanged">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [stale, setStale] = useState(false);

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
    if (error && isCancelledIntentError(error)) {
      setStale(true);
    } else if (error) {
      setErrorMessage(error.message || "Payment failed — please try again.");
    } else {
      setSucceeded(true);
    }
  };

  if (succeeded) {
    return <p className="text-sm text-ok">Payment received — thank you.</p>;
  }

  if (stale) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-warn">{ORDER_CHANGED_DURING_PAYMENT_MESSAGE}</p>
        <Button onClick={onOrderChanged}>Show updated amount</Button>
      </div>
    );
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
