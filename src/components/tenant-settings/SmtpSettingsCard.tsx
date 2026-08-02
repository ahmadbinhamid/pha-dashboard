import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SecretInput } from "@/components/ui/SecretInput";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getSmtpStatus, updateSmtpCredentials } from "@/lib/api/tenantSettings";
import type { ConnectionStatus, UpdateSmtpCredentialsPayload } from "@/types/tenantSettings";

export const SMTP_SETTINGS_FORM_ID = "smtp-settings-form";

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

type FormState = Omit<UpdateSmtpCredentialsPayload, "port"> & { port: string };

const EMPTY_FORM: FormState = { host: "", port: "", user: "", pass: "", from_name: "", from_email: "" };

export function SmtpSettingsCard({
  onMutationStateChange,
}: {
  onMutationStateChange?: (state: { isPending: boolean; isSuccess: boolean; error: string | null }) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["smtp-status"],
    queryFn: getSmtpStatus,
  });
  const status = data?.data;

  useEffect(() => {
    // Never pre-fill the password — the API never returns it, so leaving it
    // blank means "unchanged" on save (see handleSubmit below).
    setForm((f) => ({
      ...f,
      host: status?.host ?? "",
      port: status?.port ? String(status.port) : "",
      user: status?.user ?? "",
      from_name: status?.from_name ?? "",
      from_email: status?.from_email ?? "",
    }));
  }, [status?.host, status?.port, status?.user, status?.from_name, status?.from_email]);

  const mutation = useMutation({
    mutationFn: updateSmtpCredentials,
    onSuccess: () => {
      setForm((f) => ({ ...f, pass: "" }));
      queryClient.invalidateQueries({ queryKey: ["smtp-status"] });
    },
  });

  useEffect(() => {
    onMutationStateChange?.({
      isPending: mutation.isPending,
      isSuccess: mutation.isSuccess,
      error: mutation.isError ? (mutation.error as Error)?.message || "Failed to save" : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isPending, mutation.isSuccess, mutation.isError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // pass omitted entirely (not sent as "") when left blank, so the
    // previously-saved password stays in place unless deliberately changed.
    const payload: UpdateSmtpCredentialsPayload = {
      host: form.host,
      port: form.port ? Number(form.port) : null,
      user: form.user,
      from_name: form.from_name,
      from_email: form.from_email,
    };
    if (form.pass) payload.pass = form.pass;
    mutation.mutate(payload);
  };

  const handleDisconnect = () => {
    mutation.mutate({ pass: "" });
  };

  return (
    <Card>
      <CardHeader
        title="Order emails"
        description="Send order confirmations, shipping, and receipts from this store's own mailbox instead of the platform default."
        right={status ? <Badge variant={STATUS_VARIANT[status.connection_status]}>{STATUS_LABEL[status.connection_status]}</Badge> : null}
      />
      <CardContent className="space-y-6">
        {isLoading ? (
          <SkeletonText lines={4} />
        ) : (
          <>
            {status?.last_error && (
              <p className="rounded-xs bg-tag-danger-bg px-3 py-2 text-sm text-tag-danger-fg">{status.last_error}</p>
            )}

            {!status?.connected && (
              <p className="text-sm text-fg/65">
                No SMTP account connected yet — order emails currently send from the platform's default mailbox.
              </p>
            )}

            <form id={SMTP_SETTINGS_FORM_ID} className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="SMTP host">
                  <Input
                    value={form.host ?? ""}
                    placeholder="smtp.gmail.com"
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                    autoComplete="off"
                  />
                </FormField>
                <FormField label="SMTP port" hint="587 (STARTTLS) or 465 (TLS) are most common.">
                  <Input
                    type="number"
                    value={form.port ?? ""}
                    placeholder="587"
                    onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                    autoComplete="off"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Username">
                  <Input
                    value={form.user ?? ""}
                    placeholder="you@yourstore.com"
                    onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
                    autoComplete="off"
                  />
                </FormField>
                <FormField label="Password" hint={status?.connected ? "Leave blank to keep the currently saved password." : undefined}>
                  <SecretInput
                    value={form.pass ?? ""}
                    placeholder={status?.connected ? "•••••••••••••• (saved)" : "App password or SMTP password"}
                    onChange={(e) => setForm((f) => ({ ...f, pass: e.target.value }))}
                    autoComplete="off"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="From name" hint="Defaults to your business name.">
                  <Input
                    value={form.from_name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                    autoComplete="off"
                  />
                </FormField>
                <FormField label="From email" hint="Defaults to the username above.">
                  <Input
                    type="email"
                    value={form.from_email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                    autoComplete="off"
                  />
                </FormField>
              </div>

              {status?.connected && (
                <div>
                  <Button type="button" variant="outline" onClick={handleDisconnect} disabled={mutation.isPending}>
                    Disconnect
                  </Button>
                </div>
              )}
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
