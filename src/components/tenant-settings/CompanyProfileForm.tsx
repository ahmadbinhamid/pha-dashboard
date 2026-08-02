import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ColorSwatchInput } from "@/components/ui/ColorSwatchInput";
import { LogoUploadField } from "@/components/tenant-settings/LogoUploadField";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings, UpdateTenantSettingsPayload } from "@/types/tenantSettings";

export const COMPANY_PROFILE_FORM_ID = "company-profile-form";

function toFormState(settings: TenantSettings): UpdateTenantSettingsPayload {
  return {
    company_name: settings.company_name ?? "",
    abn: settings.abn ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    bank_details: settings.bank_details,
    pickup_location: settings.pickup_location,
    warranty_text: settings.warranty_text ?? "",
    legal_disclaimer_text: settings.legal_disclaimer_text ?? "",
    logo_url: settings.logo_url,
    favicon_url: settings.favicon_url,
    brand_colour: settings.brand_colour ?? "#000000",
    accent_colour: settings.accent_colour ?? "#FFFFFF",
  };
}

export function CompanyProfileForm({
  settings,
  onMutationStateChange,
}: {
  settings: TenantSettings;
  onMutationStateChange?: (state: { isPending: boolean; isSuccess: boolean; error: string | null }) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateTenantSettingsPayload>(() => toFormState(settings));

  useEffect(() => {
    setForm(toFormState(settings));
  }, [settings]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <form id={COMPANY_PROFILE_FORM_ID} className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader title="General Information" />
        <CardContent className="space-y-4">
          <FormField label="Business Name" required>
            <Input
              value={form.company_name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Business Email" required>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
            <FormField label="Business Phone Number">
              <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="ABN" hint="Australian Business Number.">
            <Input
              value={form.abn ?? ""}
              placeholder="12 345 678 901"
              onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value }))}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Branding" description="Your logo, favicon and brand colours across receipts, storefront and customer emails" />
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <LogoUploadField
              shape="circle"
              title="Business Logo"
              bullets={["Square image recommended (1:1 ratio)", "PNG or JPG • Max 5MB", "Appears on receipts & storefront"]}
              value={form.logo_url ?? null}
              onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
              onRemove={() => setForm((f) => ({ ...f, logo_url: null }))}
            />
            <LogoUploadField
              shape="square"
              title="Favicon"
              bullets={["Square image recommended (32×32px)", "PNG or ICO • Max 1MB", "Appears in browser tabs on your storefront"]}
              value={form.favicon_url ?? null}
              onChange={(url) => setForm((f) => ({ ...f, favicon_url: url }))}
              onRemove={() => setForm((f) => ({ ...f, favicon_url: null }))}
            />
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm font-semibold text-fg">Brand Colors</p>
            <p className="mt-0.5 text-xs text-fg/55">Used across your storefront, receipts and customer emails</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Primary Colour" hint="Used for buttons, links & highlights">
                <ColorSwatchInput
                  value={form.brand_colour ?? "#000000"}
                  onChange={(value) => setForm((f) => ({ ...f, brand_colour: value }))}
                />
              </FormField>
              <FormField label="Accent Colour" hint="Secondary colour for backgrounds & tags">
                <ColorSwatchInput
                  value={form.accent_colour ?? "#FFFFFF"}
                  onChange={(value) => setForm((f) => ({ ...f, accent_colour: value }))}
                />
              </FormField>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Invoice & Bank Details" description="Shown on invoices and receipts." />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Pickup address">
              <Input
                value={form.pickup_location?.address ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pickup_location: { ...f.pickup_location!, address: e.target.value } }))
                }
              />
            </FormField>
            <FormField label="Pickup country">
              <Input
                value={form.pickup_location?.country ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pickup_location: { ...f.pickup_location!, country: e.target.value } }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Bank name">
              <Input
                value={form.bank_details?.bank_name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank_details: { ...f.bank_details!, bank_name: e.target.value } }))
                }
              />
            </FormField>
            <FormField label="Account name">
              <Input
                value={form.bank_details?.account_name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank_details: { ...f.bank_details!, account_name: e.target.value } }))
                }
              />
            </FormField>
            <FormField label="BSB">
              <Input
                value={form.bank_details?.bsb ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, bank_details: { ...f.bank_details!, bsb: e.target.value } }))}
              />
            </FormField>
            <FormField label="Account number">
              <Input
                value={form.bank_details?.account_number ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank_details: { ...f.bank_details!, account_number: e.target.value } }))
                }
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Legal & Warranty Text" description="Shown on the invoice footer." />
        <CardContent className="space-y-4">
          <FormField label="Warranty & returns text">
            <Textarea
              rows={3}
              value={form.warranty_text ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, warranty_text: e.target.value }))}
            />
          </FormField>

          <FormField label="Legal disclaimer">
            <Textarea
              rows={3}
              value={form.legal_disclaimer_text ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, legal_disclaimer_text: e.target.value }))}
            />
          </FormField>
        </CardContent>
      </Card>
    </form>
  );
}
