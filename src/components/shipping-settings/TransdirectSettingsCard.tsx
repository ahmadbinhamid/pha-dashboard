import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SecretInput } from "@/components/ui/SecretInput";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { SHIPPING_ADDRESS_TYPE_OPTIONS } from "@/config/shipping";
import { useToast } from "@/context";
import { SHIPPING_SETTINGS_QUERY_KEY, getShippingSettings, testShippingConnection, updateShippingSettings } from "@/lib/api/shipping";
import { shippingSettingsFormSchema, type ShippingSettingsFormValues } from "@/lib/validation/shippingSettings";

export const TRANSDIRECT_SETTINGS_FORM_ID = "transdirect-settings-form";

type MutationState = { isPending: boolean; isSuccess: boolean; error: string | null };

// Transdirect API key and ship-from address for calculated shipping.
export function TransdirectSettingsCard({ onMutationStateChange }: { onMutationStateChange?: (state: MutationState) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: SHIPPING_SETTINGS_QUERY_KEY, queryFn: getShippingSettings });
  const settings = data?.data;

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ShippingSettingsFormValues>({
    resolver: zodResolver(shippingSettingsFormSchema),
    defaultValues: { api_key: "", sender_postcode: "", sender_suburb: "", sender_state: "", sender_type: "business" },
  });

  useEffect(() => {
    // The key is never returned; blank means "keep the saved one".
    reset({
      api_key: "",
      sender_postcode: settings?.sender_postcode ?? "",
      sender_suburb: settings?.sender_suburb ?? "",
      sender_state: settings?.sender_state ?? "",
      sender_type: settings?.sender_type ?? "business",
    });
  }, [settings, reset]);

  const saveMutation = useMutation({
    mutationFn: (form: ShippingSettingsFormValues) => updateShippingSettings({ ...form, sender_suburb: form.sender_suburb.toUpperCase() }),
    onSuccess: (res) => queryClient.setQueryData(SHIPPING_SETTINGS_QUERY_KEY, res),
  });
  const testMutation = useMutation({
    mutationFn: testShippingConnection,
    onSuccess: () => toast({ title: "Transdirect connection works", tone: "success" }),
    onError: (err: Error) => toast({ title: "Transdirect check failed", description: err.message, tone: "danger" }),
  });

  useEffect(() => {
    onMutationStateChange?.({
      isPending: saveMutation.isPending,
      isSuccess: saveMutation.isSuccess,
      error: saveMutation.isError ? saveMutation.error.message || "Failed to save" : null,
    });
  }, [saveMutation.isPending, saveMutation.isSuccess, saveMutation.isError, saveMutation.error, onMutationStateChange]);

  const configured = !!settings?.transdirect_configured;

  return (
    <Card>
      <CardHeader
        title="Calculated shipping"
        description="Products set to Calculated are priced at checkout from the customer's postcode, using the cheapest Transdirect courier."
        right={<Badge variant={configured ? "ok" : "muted"}>{configured ? "Key saved" : "Not connected"}</Badge>}
      />
      <CardContent>
        {isLoading ? (
          <SkeletonText lines={4} />
        ) : (
          <form id={TRANSDIRECT_SETTINGS_FORM_ID} className="space-y-4" onSubmit={handleSubmit((form) => saveMutation.mutate(form))}>
            <FormField label="Transdirect API key" hint={configured ? "Leave blank to keep the saved key." : "Transdirect members area › API modules."}>
              <SecretInput {...register("api_key")} placeholder={configured ? "•••••••••••••• (saved)" : "Paste your API key"} autoComplete="off" />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <FormField label="Ship-from postcode" error={errors.sender_postcode?.message}>
                <Input {...register("sender_postcode")} inputMode="numeric" maxLength={4} placeholder="2000" />
              </FormField>
              <FormField label="Suburb" className="sm:col-span-2">
                <Input {...register("sender_suburb")} placeholder="SYDNEY" />
              </FormField>
              <FormField label="State">
                <Input {...register("sender_state")} placeholder="NSW" maxLength={10} />
              </FormField>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <FormField label="Pickup address type" className="sm:w-60">
                <Controller
                  control={control}
                  name="sender_type"
                  render={({ field }) => <SingleSelect options={SHIPPING_ADDRESS_TYPE_OPTIONS} value={field.value} onChange={field.onChange} />}
                />
              </FormField>
              <Button type="button" variant="secondary" size="sm" disabled={!configured || testMutation.isPending} onClick={() => testMutation.mutate()}>
                {testMutation.isPending ? "Checking…" : "Test connection"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
