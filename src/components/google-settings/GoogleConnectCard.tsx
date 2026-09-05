import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getChannels } from "@/lib/api/channels";
import { getGoogleConnectUrl } from "@/lib/api/google";
import { googleConnectFormSchema, GOOGLE_TARGET_COUNTRIES, type GoogleConnectFormValues } from "@/lib/validation/googleConnectForm";
import type { ChannelConnectionStatus } from "@/types/channel";

const STATUS_VARIANT: Record<ChannelConnectionStatus, "ok" | "warn" | "danger" | "muted"> = {
  connected: "ok",
  degraded: "warn",
  error: "danger",
  disconnected: "muted",
};

const STATUS_LABEL: Record<ChannelConnectionStatus, string> = {
  connected: "Connected",
  degraded: "Sync paused — repeated errors",
  error: "Connection error",
  disconnected: "Not connected",
};

const DEFAULT_VALUES: GoogleConnectFormValues = {
  merchantId: "",
  feedLabel: "",
  contentLanguage: "en",
  targetCountry: "AU",
};

// Maps the specific `reason` codes google.controller.js's oauthCallback can
// redirect with to a friendlier message — falls back to the raw reason for
// anything not explicitly handled here, so a new/unmapped backend reason
// still shows *something* actionable rather than silently disappearing.
function connectErrorMessage(reason: string | null): string {
  switch (reason) {
    case "registration_pending":
      return "Almost there — Google just registered this connection and needs a few minutes to finish propagating. Wait 5 minutes, then try Connect again.";
    case "registration_conflict":
      return "This app is already connected to a different Google Merchant Center account and can't be connected to two accounts at once. Contact support if you need to switch accounts.";
    default:
      return `Failed to connect Google Merchant Center account${reason ? ` (${reason})` : ""}. Please try again.`;
  }
}

export function GoogleConnectCard() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const callbackResult = searchParams.get("google_connect");
  const callbackReason = searchParams.get("reason");

  // Clear the one-time callback query params so a page refresh doesn't
  // re-show a stale success/error banner — mirrors EbayConnectCard.
  useEffect(() => {
    if (!callbackResult) return;
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    const next = new URLSearchParams(searchParams);
    next.delete("google_connect");
    next.delete("reason");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackResult]);

  // No dedicated GET /google/settings exists yet (see types/googleSettings.ts's
  // own comment) — the generic channels list is the only source of this
  // tenant's Google connection status/health today.
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
  });
  const googleChannel = channelsData?.data.find((c) => c.key === "google");
  const connectionStatus = googleChannel?.connection.status ?? "disconnected";

  const { control, register, handleSubmit, formState } = useForm<GoogleConnectFormValues>({
    resolver: zodResolver(googleConnectFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const connectMutation = useMutation({
    mutationFn: (values: GoogleConnectFormValues) => getGoogleConnectUrl(values),
    onSuccess: (res) => {
      window.location.href = res.data.url;
    },
  });

  const onSubmit = (values: GoogleConnectFormValues) => connectMutation.mutate(values);

  return (
    <Card>
      <CardHeader
        title="Google Shopping integration"
        description="Connect this store's Google Merchant Center account to publish and sync listings."
        right={<Badge variant={STATUS_VARIANT[connectionStatus]}>{STATUS_LABEL[connectionStatus]}</Badge>}
      />
      <CardContent>
        {channelsLoading ? (
          <SkeletonText lines={2} />
        ) : (
          <div className="flex flex-col gap-4">
            {callbackResult === "success" && (
              <p className="rounded-xs bg-tag-success-bg px-3 py-2 text-sm text-tag-success-fg">
                Google Merchant Center account connected successfully.
              </p>
            )}
            {callbackResult === "error" && (
              <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">
                {connectErrorMessage(callbackReason)}
              </p>
            )}

            {googleChannel?.connection.last_error && connectionStatus !== "connected" && (
              <p className="text-xs font-medium text-danger">{googleChannel.connection.last_error}</p>
            )}

            {connectionStatus === "connected" ? (
              <p className="text-sm text-fg/65">
                This store is connected to Google Shopping and syncing listings. Feed settings below are only
                used the next time you connect/reconnect — re-run connect to point at a different Merchant
                Center account or feed.
              </p>
            ) : (
              <p className="text-sm text-fg/65">
                No Google Merchant Center account connected yet — listings can be created locally but won't
                sync to Google Shopping.
              </p>
            )}

            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
              <FormField
                label="Merchant Center ID"
                htmlFor="google-merchant-id"
                required
                hint="The numeric account ID from your Google Merchant Center account."
                error={formState.errors.merchantId?.message}
              >
                <Input id="google-merchant-id" placeholder="e.g. 123456789" {...register("merchantId")} />
              </FormField>

              <FormField
                label="Feed label"
                htmlFor="google-feed-label"
                required
                hint="A short label for this product feed, e.g. AU."
                error={formState.errors.feedLabel?.message}
              >
                <Input id="google-feed-label" placeholder="e.g. AU" {...register("feedLabel")} />
              </FormField>

              <FormField
                label="Content language"
                htmlFor="google-content-language"
                required
                hint="ISO language code for your listings, e.g. en."
                error={formState.errors.contentLanguage?.message}
              >
                <Input id="google-content-language" placeholder="e.g. en" {...register("contentLanguage")} />
              </FormField>

              <FormField label="Target country" required error={formState.errors.targetCountry?.message}>
                <Controller
                  control={control}
                  name="targetCountry"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOOGLE_TARGET_COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={connectMutation.isPending}>
                  {connectMutation.isPending
                    ? "Redirecting…"
                    : connectionStatus === "connected"
                      ? "Reconnect Google Shopping"
                      : "Connect Google Shopping"}
                </Button>
              </div>
            </form>
            {connectMutation.isError && (
              <p className="text-xs font-medium text-danger">
                {(connectMutation.error as Error)?.message || "Failed to start Google Shopping connection"}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
