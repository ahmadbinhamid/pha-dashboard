import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/Select";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings } from "@/types/tenantSettings";
import { paymentDomainFormSchema, type PaymentDomainFormValues } from "@/lib/validation/tenantSettings";

export const PAYMENT_DOMAIN_FORM_ID = "payment-domain-form";

function toFormState(settings: TenantSettings): PaymentDomainFormValues {
  return {
    payment_domain_mode: settings.payment_domain_mode ?? "default",
  };
}

export function PaymentDomainForm({
  settings,
  onMutationStateChange,
}: {
  settings: TenantSettings;
  onMutationStateChange?: (state: { isPending: boolean; isSuccess: boolean; error: string | null }) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm<PaymentDomainFormValues>({
    resolver: zodResolver(paymentDomainFormSchema),
    defaultValues: toFormState(settings),
  });

  const paymentDomainMode = watch("payment_domain_mode");

  useEffect(() => {
    reset(toFormState(settings));
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
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

  const onSubmit = (values: PaymentDomainFormValues) => mutation.mutate(values);

  return (
    <form id={PAYMENT_DOMAIN_FORM_ID} className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader
          title="Payment page address"
          description="Choose which domain hosts your payment, link, and subscription pages."
        />
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-card/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg/50">Your customers will see links like</p>
            <p className="mt-2 break-all font-mono text-sm text-fg">
              {paymentDomainMode === "vendor_slug"
                ? settings.payment_link_preview.vendor_slug
                : settings.payment_link_preview.default}
            </p>
          </div>

          <FormField label="Payment domain">
            <NativeSelect {...register("payment_domain_mode")}>
              <option value="default">Use default payment domain</option>
              <option value="vendor_slug">{`Use my store domain (${settings.slug})`}</option>
            </NativeSelect>
          </FormField>
        </CardContent>
      </Card>
    </form>
  );
}
