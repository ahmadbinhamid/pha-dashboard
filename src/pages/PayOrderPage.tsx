import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { GuestCheckoutForm } from "@/components/payments/GuestCheckoutForm";
import { getGuestOrder, createGuestPaymentIntent } from "@/lib/api/guestPayment";
import { formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";

// Shared, platform-hosted payment page for every tenant's payment-link orders (stripe.payment.service.js#createPaymentLinkForOrder). No login/branding — security is the guest `token` in the URL. Only a real 404 means the link is dead; other failures (rotated token, CORS, transport) shouldn't tell the customer to chase a new link.
// Reads `.status`, not axios internals: the client's interceptor (lib/api/client.ts) rejects with a plain Error carrying `status`; no status means the request never got a response.
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
    return <StatusShell message={payLinkErrorMessage(error)} />;
  }

  const amountDue = order.total - (order.payment?.amount ?? 0);
  const alreadyPaid = order.payment_status === "paid" || order.fulfillment_status === "completed" || amountDue <= 0;

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
            <GuestCheckoutForm
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
