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
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getChannels } from "@/lib/api/channels";
import { getGoogleConnectUrl, getGoogleAccounts, completeGoogleConnect } from "@/lib/api/google";
import {
  googleCompleteConnectFormSchema,
  GOOGLE_TARGET_COUNTRIES,
  type GoogleCompleteConnectFormValues,
} from "@/lib/validation/googleConnectForm";
import type { ChannelConnectionStatus } from "@/types/channel";
import { ChannelAttentionNotice } from "@/components/channels/ChannelAttentionNotice";

const STATUS_VARIANT: Record<ChannelConnectionStatus, "ok" | "warn" | "danger" | "muted"> = {
  connected: "ok",
  degraded: "warn",
  error: "danger",
  disconnected: "muted",
  pending: "warn",
};

const STATUS_LABEL: Record<ChannelConnectionStatus, string> = {
  connected: "Connected",
  degraded: "Sync paused — repeated errors",
  error: "Connection error",
  disconnected: "Not connected",
  pending: "Choose a Merchant Center account to finish connecting",
};

const DEFAULT_VALUES: GoogleCompleteConnectFormValues = {
  merchantId: "",
  targetCountry: "AU",
  feedLabel: "",
  contentLanguage: "en",
};

// Maps oauth redirect / completeConnect `reason` codes; unknown ones show raw.
function connectErrorMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "registration_pending":
      return "Almost there — Google just registered this connection and needs a few minutes to finish propagating. Wait 5 minutes, then try again.";
    case "registration_conflict":
      return "This app is already connected to a different Google Merchant Center account and can't be connected to two accounts at once. Contact support if you need to switch accounts.";
    case "merchant_not_accessible":
      return "That Google account doesn't have access to this Merchant Center account — double check the ID, or pick a different account from the list.";
    case "no_pending_connection":
      return "Your Google sign-in session expired before you finished choosing an account — click Connect Google Shopping again.";
    default:
      return `Failed to connect Google Merchant Center account${reason ? ` (${reason})` : ""}. Please try again.`;
  }
}

export function GoogleConnectCard() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const callbackResult = searchParams.get("google_connect");
  const callbackReason = searchParams.get("reason");
  const choosingAccount = callbackResult === "choose_account";

  // Only error params auto-clear; choose_account must survive a step-2 refresh.
  useEffect(() => {
    if (callbackResult !== "error") return;
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    const next = new URLSearchParams(searchParams);
    next.delete("google_connect");
    next.delete("reason");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackResult]);

  // No GET /google/settings yet; the channels list is the only status source.
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
  });
  const googleChannel = channelsData?.data.find((c) => c.key === "google");
  const connectionStatus = googleChannel?.connection.status ?? "disconnected";
  // Treat as available while loading so the card doesn't flash unavailable.
  const unavailable = googleChannel ? !googleChannel.available : false;
  const unavailableReason = googleChannel?.unavailable_reason ?? null;

  // Step 1: no form; consent comes before a Merchant Center account is chosen.
  const connectMutation = useMutation({
    mutationFn: getGoogleConnectUrl,
    onSuccess: (res) => {
      window.location.href = res.data.url;
    },
  });

  // Step 2: fetched only after returning with ?google_connect=choose_account.
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["google-accounts"],
    queryFn: getGoogleAccounts,
    enabled: choosingAccount,
  });
  const accounts = accountsData?.data.accounts ?? [];
  const listSupported = accountsData?.data.listSupported ?? true;

  const { control, register, handleSubmit, watch, setValue, formState } = useForm<GoogleCompleteConnectFormValues>({
    resolver: zodResolver(googleCompleteConnectFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Prefill feedLabel from the target country until the user edits it.
  const targetCountry = watch("targetCountry");
  useEffect(() => {
    if (!formState.dirtyFields.feedLabel) setValue("feedLabel", targetCountry);
  }, [targetCountry, formState.dirtyFields.feedLabel, setValue]);

  const completeMutation = useMutation({
    mutationFn: completeGoogleConnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      const next = new URLSearchParams(searchParams);
      next.delete("google_connect");
      next.delete("reason");
      setSearchParams(next, { replace: true });
    },
  });

  const onSubmitAccount = (values: GoogleCompleteConnectFormValues) =>
    completeMutation.mutate({
      merchantId: values.merchantId,
      targetCountry: values.targetCountry,
      feedLabel: values.feedLabel || undefined,
      contentLanguage: values.contentLanguage || undefined,
    });

  return (
    <Card>
      <CardHeader
        title="Google Shopping integration"
        description="Connect this store's Google Merchant Center account to publish and sync listings."
        right={
          unavailable ? (
            <Badge variant="muted">Unavailable</Badge>
          ) : (
            <Badge variant={STATUS_VARIANT[connectionStatus]}>
              {googleChannel?.connection.status_reason ? "Needs attention" : STATUS_LABEL[connectionStatus]}
            </Badge>
          )
        }
      />
      <CardContent>
        {channelsLoading ? (
          <SkeletonText lines={2} />
        ) : (
          <div className="flex flex-col gap-4">
            {callbackResult === "error" && (
              <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">
                {connectErrorMessage(callbackReason)}
              </p>
            )}
            {completeMutation.isSuccess && (
              <p className="rounded-xs bg-tag-success-bg px-3 py-2 text-sm text-tag-success-fg">
                Google Merchant Center account connected successfully.
              </p>
            )}
            {completeMutation.isError && (
              <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">
                {connectErrorMessage((completeMutation.error as Error & { reason?: string })?.reason) ||
                  (completeMutation.error as Error)?.message}
              </p>
            )}

            {googleChannel?.connection.status_reason ? (
              <ChannelAttentionNotice channel={googleChannel} />
            ) : (
              googleChannel?.connection.last_error &&
              connectionStatus !== "connected" && (
                <p className="text-xs font-medium text-danger">{googleChannel.connection.last_error}</p>
              )
            )}

            {unavailable ? (
              <p className="rounded-xs bg-tag-warn-bg px-3 py-2 text-sm text-tag-warn-fg">{unavailableReason}</p>
            ) : choosingAccount ? (
              <>
                <p className="text-sm text-fg/65">
                  You've granted Google access — pick which Merchant Center account this store should publish to.
                </p>
                {accountsLoading ? (
                  <SkeletonText lines={3} />
                ) : (
                  <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmitAccount)}>
                    {listSupported && accounts.length > 0 ? (
                      <FormField
                        label="Merchant Center account"
                        htmlFor="google-merchant-account"
                        required
                        error={formState.errors.merchantId?.message}
                      >
                        <Controller
                          control={control}
                          name="merchantId"
                          render={({ field }) => (
                            <SingleSelect
                              id="google-merchant-account"
                              options={accounts.map((a) => ({
                                value: a.accountId,
                                label: a.accountName ? `${a.accountName} (${a.accountId})` : a.accountId,
                              }))}
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              placeholder="Choose an account"
                            />
                          )}
                        />
                      </FormField>
                    ) : (
                      <FormField
                        label="Merchant Center ID"
                        htmlFor="google-merchant-id"
                        required
                        hint={
                          listSupported
                            ? "This Google account has no Merchant Center accounts we could list — enter the numeric ID directly."
                            : "We couldn't list your Merchant Center accounts automatically — enter the numeric account ID from Google Merchant Center directly."
                        }
                        error={formState.errors.merchantId?.message}
                      >
                        <Input id="google-merchant-id" placeholder="e.g. 123456789" {...register("merchantId")} />
                      </FormField>
                    )}

                    <FormField label="Target country" required error={formState.errors.targetCountry?.message}>
                      <Controller
                        control={control}
                        name="targetCountry"
                        render={({ field }) => (
                          <SingleSelect
                            options={[...GOOGLE_TARGET_COUNTRIES]}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    </FormField>

                    <FormField
                      label="Feed label"
                      htmlFor="google-feed-label"
                      hint="Defaults to the target country — override only if you use a different feed label."
                      error={formState.errors.feedLabel?.message}
                    >
                      <Input id="google-feed-label" {...register("feedLabel")} />
                    </FormField>

                    <FormField
                      label="Content language"
                      htmlFor="google-content-language"
                      hint="ISO language code for your listings — defaults to en."
                      error={formState.errors.contentLanguage?.message}
                    >
                      <Input id="google-content-language" {...register("contentLanguage")} />
                    </FormField>

                    <div className="sm:col-span-2">
                      <Button type="submit" disabled={completeMutation.isPending}>
                        {completeMutation.isPending ? "Connecting…" : "Finish connecting"}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-fg/65">
                  {connectionStatus === "connected"
                    ? "This store is connected to Google Shopping and syncing listings."
                    : "No Google Merchant Center account connected yet — listings can be created locally but won't sync to Google Shopping."}
                </p>
                <div>
                  <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                    {connectMutation.isPending
                      ? "Redirecting…"
                      : connectionStatus === "connected"
                        ? "Reconnect Google Shopping"
                        : "Connect Google Shopping"}
                  </Button>
                </div>
                {connectMutation.isError && (
                  <p className="text-xs font-medium text-danger">
                    {(connectMutation.error as Error)?.message || "Failed to start Google Shopping connection"}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
