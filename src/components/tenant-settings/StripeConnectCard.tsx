import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkeletonText } from "@/components/ui/Skeleton";
import { StripeOnboardingPanel } from "@/components/tenant-settings/StripeOnboardingPanel";
import { connectStripeAccount, getStripeConnectStatus } from "@/lib/api/tenantSettings";
import type { StripeOnboardingStatus } from "@/types/tenantSettings";

const STATUS_VARIANT: Record<StripeOnboardingStatus, "ok" | "warn" | "muted"> = {
  complete: "ok",
  in_progress: "warn",
  not_started: "muted",
};

const STATUS_LABEL: Record<StripeOnboardingStatus, string> = {
  complete: "Connected",
  in_progress: "Onboarding in progress",
  not_started: "Not connected",
};

export function StripeConnectCard() {
  const queryClient = useQueryClient();
  const [onboarding, setOnboarding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stripe-connect-status"],
    queryFn: getStripeConnectStatus,
  });
  const status = data?.data;

  const connectMutation = useMutation({
    mutationFn: connectStripeAccount,
    onSuccess: () => {
      setOnboarding(true);
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    },
  });

  const handleOnboardingExit = () => {
    setOnboarding(false);
    queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
  };

  return (
    <Card>
      <CardHeader
        title="Stripe payments"
        description="Connect a Stripe account to accept card payments for this store."
        right={status ? <Badge variant={STATUS_VARIANT[status.onboarding_status]}>{STATUS_LABEL[status.onboarding_status]}</Badge> : null}
      />
      <CardContent>
        {isLoading ? (
          <SkeletonText lines={2} />
        ) : onboarding || status?.onboarding_status === "in_progress" ? (
          <StripeOnboardingPanel onExit={handleOnboardingExit} />
        ) : status?.onboarding_status === "complete" ? (
          <p className="text-sm text-fg/65">
            This store is set up to accept payments.
            {status.payouts_enabled ? " Payouts are enabled." : " Payouts are still being verified by Stripe."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg/65">
              No Stripe account connected yet — customers can't pay by card until this is set up.
            </p>
            <div>
              <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                {connectMutation.isPending ? "Connecting…" : "Connect Stripe account"}
              </Button>
            </div>
            {connectMutation.isError && (
              <p className="text-xs font-medium text-danger">
                {(connectMutation.error as Error)?.message || "Failed to start Stripe onboarding"}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
