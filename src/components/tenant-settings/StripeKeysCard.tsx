import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SecretInput } from "@/components/ui/SecretInput";
import { CopyField } from "@/components/ui/CopyField";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getStripeStatus, updateStripeKeys, updateStripeWebhookSecret } from "@/lib/api/tenantSettings";
import type { ConnectionStatus, UpdateStripeKeysPayload } from "@/types/tenantSettings";
import {
  stripeKeysFormSchema,
  webhookSecretFormSchema,
  type StripeKeysFormValues,
  type WebhookSecretFormValues,
} from "@/lib/validation/stripeKeys";

export const STRIPE_KEYS_FORM_ID = "stripe-keys-form";

const STATUS_VARIANT: Record<ConnectionStatus, "ok" | "danger" | "muted"> = {
  connected: "ok",
  error: "danger",
  not_connected: "muted",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  error: "Connection error",
  not_connected: "Not connected",
};

export function StripeKeysCard({
  onMutationStateChange,
}: {
  onMutationStateChange?: (state: { isPending: boolean; isSuccess: boolean; error: string | null }) => void;
}) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset } = useForm<StripeKeysFormValues>({
    resolver: zodResolver(stripeKeysFormSchema),
    defaultValues: { secret_key: "", publishable_key: "" },
  });

  const {
    register: registerWebhook,
    handleSubmit: handleWebhookSubmit,
    reset: resetWebhook,
    watch: watchWebhook,
  } = useForm<WebhookSecretFormValues>({
    resolver: zodResolver(webhookSecretFormSchema),
    defaultValues: { webhook_secret: "" },
  });
  const webhookSecretInput = watchWebhook("webhook_secret");

  const { data, isLoading } = useQuery({
    queryKey: ["stripe-status"],
    queryFn: getStripeStatus,
  });
  const status = data?.data;

  useEffect(() => {
    // Never pre-fill the secret key input — the API never returns it, so
    // leaving it blank means "unchanged" on save (see onSubmit below).
    reset({ secret_key: "", publishable_key: status?.publishable_key ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.publishable_key]);

  const keysMutation = useMutation({
    mutationFn: updateStripeKeys,
    onSuccess: () => {
      reset((current) => ({ ...current, secret_key: "" }));
      queryClient.invalidateQueries({ queryKey: ["stripe-status"] });
    },
  });

  useEffect(() => {
    onMutationStateChange?.({
      isPending: keysMutation.isPending,
      isSuccess: keysMutation.isSuccess,
      error: keysMutation.isError ? (keysMutation.error as Error)?.message || "Failed to save" : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysMutation.isPending, keysMutation.isSuccess, keysMutation.isError]);

  const webhookSecretMutation = useMutation({
    mutationFn: updateStripeWebhookSecret,
    onSuccess: () => {
      resetWebhook({ webhook_secret: "" });
      queryClient.invalidateQueries({ queryKey: ["stripe-status"] });
    },
  });

  const onSubmit = (form: StripeKeysFormValues) => {
    // secret_key omitted entirely (not sent as "") when left blank, so the
    // previously-saved key stays in place unless the tenant deliberately types a new one.
    const payload: UpdateStripeKeysPayload = { publishable_key: form.publishable_key };
    if (form.secret_key) payload.secret_key = form.secret_key;
    keysMutation.mutate(payload);
  };

  const onSubmitWebhookSecret = (values: WebhookSecretFormValues) => {
    webhookSecretMutation.mutate(values.webhook_secret);
  };

  const handleDisconnect = () => {
    keysMutation.mutate({ secret_key: "" });
  };

  return (
    <Card>
      <CardHeader
        title="Stripe payments"
        description="Connect this store's own Stripe account to accept card payments."
        right={status ? <Badge variant={STATUS_VARIANT[status.connection_status]}>{STATUS_LABEL[status.connection_status]}</Badge> : null}
      />
      <CardContent className="space-y-6">
        {isLoading ? (
          <SkeletonText lines={3} />
        ) : (
          <>
            {status?.last_error && (
              <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">{status.last_error}</p>
            )}

            <form id={STRIPE_KEYS_FORM_ID} className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <FormField
                label="Secret key"
                hint={status?.connected ? "Leave blank to keep the currently saved key." : "e.g. sk_live_… or sk_test_… — found in your Stripe Dashboard under Developers → API keys."}
              >
                <SecretInput
                  {...register("secret_key")}
                  placeholder={status?.connected ? "•••••••••••••••••••• (saved)" : "sk_live_…"}
                  autoComplete="off"
                />
              </FormField>

              <FormField label="Publishable key" hint="Safe to share — used to initialize card payment forms.">
                <Input {...register("publishable_key")} placeholder="pk_live_…" autoComplete="off" />
              </FormField>

              {status?.connected && (
                <div>
                  <Button type="button" variant="outline" onClick={handleDisconnect} disabled={keysMutation.isPending}>
                    Disconnect Stripe account
                  </Button>
                </div>
              )}
            </form>

            {status?.connected && (
              <div className="space-y-3 border-t border-border pt-6">
                <div>
                  <p className="text-sm font-semibold text-fg">Webhook</p>
                  <p className="mt-0.5 text-xs text-fg/55">
                    Confirms payments and refunds automatically. Registered on your Stripe account when you connected —
                    if that failed (e.g. a restricted API key), set it up manually below.
                  </p>
                </div>

                {status.webhook_configured ? (
                  <p className="text-sm text-ok">Webhook connected.</p>
                ) : (
                  <form className="space-y-3" onSubmit={handleWebhookSubmit(onSubmitWebhookSecret)}>
                    {status.webhook_url && (
                      <FormField label="Webhook URL" hint="Add this as an endpoint in Stripe Dashboard → Developers → Webhooks.">
                        <CopyField value={status.webhook_url} />
                      </FormField>
                    )}
                    <FormField label="Signing secret" hint="Paste the whsec_… value Stripe shows after creating the endpoint.">
                      <div className="flex gap-2">
                        <SecretInput {...registerWebhook("webhook_secret")} placeholder="whsec_…" autoComplete="off" />
                        <Button
                          type="submit"
                          disabled={!webhookSecretInput || webhookSecretMutation.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    </FormField>
                    {webhookSecretMutation.isError && (
                      <p className="text-xs font-medium text-danger">
                        {(webhookSecretMutation.error as Error)?.message || "Failed to save"}
                      </p>
                    )}
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
