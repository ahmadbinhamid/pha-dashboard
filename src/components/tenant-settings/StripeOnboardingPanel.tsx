import { useMemo } from "react";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";
import { createStripeAccountSession } from "@/lib/api/tenantSettings";

// Embedded onboarding — the merchant fills out Stripe's Connect onboarding
// form inline, inside this dashboard, never redirected to a stripe.com page
// or asked to log into a separate Stripe account (matches flowpos-backend's
// controller-based Connect pattern: stripe_dashboard.type: "none").
export function StripeOnboardingPanel({ onExit }: { onExit: () => void }) {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

  const connectInstance = useMemo<StripeConnectInstance | null>(() => {
    if (!publishableKey) return null;
    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const res = await createStripeAccountSession();
        return res.data.client_secret;
      },
    });
  }, [publishableKey]);

  if (!connectInstance) {
    return (
      <p className="text-sm text-danger">
        Stripe onboarding is not configured — VITE_STRIPE_PUBLISHABLE_KEY is missing.
      </p>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      <ConnectAccountOnboarding onExit={onExit} />
    </ConnectComponentsProvider>
  );
}
