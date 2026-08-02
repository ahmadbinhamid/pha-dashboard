import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { updateEbaySettings, getBusinessPolicies } from "@/lib/api/ebay";
import type { EbaySettings, UpdateEbaySettingsPayload } from "@/types/ebaySettings";

const MARKETPLACES = [
  { value: "EBAY_AU", label: "Australia" },
  { value: "EBAY_US", label: "United States" },
  { value: "EBAY_GB", label: "United Kingdom" },
];

function toFormState(settings: EbaySettings): UpdateEbaySettingsPayload {
  return {
    marketplace_id: settings.marketplace_id,
    merchant_location_key: settings.merchant_location_key ?? "",
    fulfillment_policy_id: settings.fulfillment_policy_id ?? "",
    payment_policy_id: settings.payment_policy_id ?? "",
    return_policy_id: settings.return_policy_id ?? "",
    warehouse_street: settings.warehouse_street ?? "",
    warehouse_city: settings.warehouse_city ?? "",
    warehouse_state: settings.warehouse_state ?? "",
    warehouse_postcode: settings.warehouse_postcode ?? "",
    warehouse_country: settings.warehouse_country ?? "AU",
    warehouse_phone: settings.warehouse_phone ?? "",
    fallback_image_url: settings.fallback_image_url ?? "",
  };
}

export const EBAY_SETTINGS_FORM_ID = "ebay-settings-form";

export function EbaySettingsForm({
  settings,
  onMutationStateChange,
}: {
  settings: EbaySettings;
  onMutationStateChange?: (state: { isPending: boolean; isSuccess: boolean; error: string | null }) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateEbaySettingsPayload>(() => toFormState(settings));

  useEffect(() => {
    setForm(toFormState(settings));
  }, [settings]);

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ["ebay-business-policies"],
    queryFn: getBusinessPolicies,
    enabled: settings.connection_status === "connected",
  });
  const policies = policiesData?.data;

  const mutation = useMutation({
    mutationFn: updateEbaySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebay-settings"] });
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
    mutation.mutate(form);
  };

  const policySelect = (
    label: string,
    field: "fulfillment_policy_id" | "payment_policy_id" | "return_policy_id",
    options: { id: string; name: string }[] | undefined,
  ) => (
    <FormField label={label}>
      <Select
        value={form[field] ?? ""}
        onValueChange={(v) => setForm((f) => ({ ...f, [field]: v }))}
        disabled={policiesLoading}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={policiesLoading ? "Loading…" : !options?.length ? "No policies found" : "Select policy"}
          />
        </SelectTrigger>
        <SelectContent>
          {(options ?? []).map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );

  return (
    <Card>
      <CardHeader
        title="eBay settings"
        description="Marketplace, warehouse address, and default business policies for eBay listings."
      />
      <CardContent>
        <form id={EBAY_SETTINGS_FORM_ID} className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Marketplace">
              <Select
                value={form.marketplace_id ?? "EBAY_AU"}
                onValueChange={(v) => setForm((f) => ({ ...f, marketplace_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETPLACES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Merchant location key" hint="A unique identifier for your warehouse on eBay.">
              <Input
                value={form.merchant_location_key ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, merchant_location_key: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {policySelect("Fulfillment policy", "fulfillment_policy_id", policies?.fulfillment)}
            {policySelect("Payment policy", "payment_policy_id", policies?.payment)}
            {policySelect("Return policy", "return_policy_id", policies?.return)}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Warehouse street">
              <Input
                value={form.warehouse_street ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_street: e.target.value }))}
              />
            </FormField>
            <FormField label="Warehouse city">
              <Input
                value={form.warehouse_city ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_city: e.target.value }))}
              />
            </FormField>
            <FormField label="Warehouse state">
              <Input
                value={form.warehouse_state ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_state: e.target.value }))}
              />
            </FormField>
            <FormField label="Warehouse postcode">
              <Input
                value={form.warehouse_postcode ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_postcode: e.target.value }))}
              />
            </FormField>
            <FormField label="Warehouse country">
              <Input
                value={form.warehouse_country ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_country: e.target.value }))}
              />
            </FormField>
            <FormField label="Warehouse phone">
              <Input
                value={form.warehouse_phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_phone: e.target.value }))}
              />
            </FormField>
          </div>

          {settings.sandbox && (
            <FormField
              label="Sandbox fallback image URL"
              hint="Used only while 'Use eBay sandbox' is on, when a listing has no public HTTPS image (e.g. your local UPLOADS_URL isn't publicly reachable). Never used in production."
            >
              <Input
                value={form.fallback_image_url ?? ""}
                placeholder="https://example.com/auto-part-placeholder.jpg"
                onChange={(e) => setForm((f) => ({ ...f, fallback_image_url: e.target.value }))}
              />
            </FormField>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
