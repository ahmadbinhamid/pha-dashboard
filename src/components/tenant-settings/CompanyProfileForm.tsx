import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ColorSwatchInput } from "@/components/ui/ColorSwatchInput";
import { StringListField } from "@/components/ui/StringListField";
import { LogoUploadField } from "@/components/tenant-settings/LogoUploadField";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings } from "@/types/tenantSettings";
import { companyProfileFormSchema, type CompanyProfileFormValues } from "@/lib/validation/companyProfile";

export const COMPANY_PROFILE_FORM_ID = "company-profile-form";

function toFormState(settings: TenantSettings): CompanyProfileFormValues {
  return {
    company_name: settings.company_name ?? "",
    abn: settings.abn ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    bank_details: {
      bank_name: settings.bank_details?.bank_name ?? "",
      account_name: settings.bank_details?.account_name ?? "",
      bsb: settings.bank_details?.bsb ?? "",
      account_number: settings.bank_details?.account_number ?? "",
    },
    pickup_location: {
      name: settings.pickup_location?.name ?? "",
      address: settings.pickup_location?.address ?? "",
      country: settings.pickup_location?.country ?? "",
      trading_hours: settings.pickup_location?.trading_hours ?? [],
    },
    warranty_text: settings.warranty_text ?? "",
    legal_disclaimer_text: settings.legal_disclaimer_text ?? "",
    logo_url: settings.logo_url,
    favicon_url: settings.favicon_url,
    brand_colour: settings.brand_colour ?? "#000000",
    accent_colour: settings.accent_colour ?? "#FFFFFF",
    order_number_prefix: settings.order_number_prefix ?? "ORD",
    invoice_number_prefix: settings.invoice_number_prefix ?? "INV",
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

  const { register, control, handleSubmit, reset } = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileFormSchema),
    defaultValues: toFormState(settings),
  });

  useEffect(() => {
    reset(toFormState(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onSubmit = (form: CompanyProfileFormValues) => {
    mutation.mutate({
      ...form,
      pickup_location: {
        ...form.pickup_location,
        trading_hours: (form.pickup_location.trading_hours ?? []).map((s) => s.trim()).filter(Boolean),
      },
    });
  };

  return (
    <form id={COMPANY_PROFILE_FORM_ID} className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader title="General Information" />
        <CardContent className="space-y-4">
          <FormField label="Business Name" required>
            <Input {...register("company_name")} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Business Email" required>
              <Input type="email" {...register("email")} />
            </FormField>
            <FormField label="Business Phone Number">
              <Input {...register("phone")} />
            </FormField>
          </div>

          <FormField label="ABN" hint="Australian Business Number.">
            <Input {...register("abn")} placeholder="12 345 678 901" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Branding" description="Your logo, favicon and brand colours across receipts, storefront and customer emails" />
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Controller
              control={control}
              name="logo_url"
              render={({ field }) => (
                <LogoUploadField
                  shape="circle"
                  title="Business Logo"
                  bullets={["Square image recommended (1:1 ratio)", "PNG or JPG • Max 5MB", "Appears on receipts & storefront"]}
                  value={field.value}
                  onChange={field.onChange}
                  onRemove={() => field.onChange(null)}
                />
              )}
            />
            <Controller
              control={control}
              name="favicon_url"
              render={({ field }) => (
                <LogoUploadField
                  shape="square"
                  title="Favicon"
                  bullets={["Square image recommended (32×32px)", "PNG or ICO • Max 1MB", "Appears in browser tabs on your storefront"]}
                  value={field.value}
                  onChange={field.onChange}
                  onRemove={() => field.onChange(null)}
                />
              )}
            />
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm font-semibold text-fg">Brand Colors</p>
            <p className="mt-0.5 text-xs text-fg/55">Used across your storefront, receipts and customer emails</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Primary Colour" hint="Used for buttons, links & highlights">
                <Controller
                  control={control}
                  name="brand_colour"
                  render={({ field }) => <ColorSwatchInput value={field.value} onChange={field.onChange} />}
                />
              </FormField>
              <FormField label="Accent Colour" hint="Secondary colour for backgrounds & tags">
                <Controller
                  control={control}
                  name="accent_colour"
                  render={({ field }) => <ColorSwatchInput value={field.value} onChange={field.onChange} />}
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
            <FormField
              label="Order number prefix"
              hint={`e.g. "ORD" → ORD-00001. Only affects orders created from now on — existing orders keep the prefix they were created with.`}
            >
              <Controller
                control={control}
                name="order_number_prefix"
                render={({ field }) => (
                  <Input
                    value={field.value}
                    maxLength={10}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Invoice number prefix"
              hint={`e.g. "INV" → INV-00001. Only affects invoices created from now on.`}
            >
              <Controller
                control={control}
                name="invoice_number_prefix"
                render={({ field }) => (
                  <Input
                    value={field.value}
                    maxLength={10}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Pickup location name" hint="Shown as the heading on pickup-ready emails.">
              <Input {...register("pickup_location.name")} />
            </FormField>
            <FormField label="Pickup address">
              <Input {...register("pickup_location.address")} />
            </FormField>
          </div>

          <FormField label="Pickup country">
            <Input {...register("pickup_location.country")} />
          </FormField>

          <FormField label="Trading hours" hint="Shown to customers on 'ready for pickup' emails, one line per row.">
            <Controller
              control={control}
              name="pickup_location.trading_hours"
              render={({ field }) => (
                <StringListField
                  values={field.value}
                  onChange={field.onChange}
                  placeholder="e.g. Mon–Fri: 9am – 5pm"
                  addLabel="Add trading hours line"
                />
              )}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Bank name">
              <Input {...register("bank_details.bank_name")} />
            </FormField>
            <FormField label="Account name">
              <Input {...register("bank_details.account_name")} />
            </FormField>
            <FormField label="BSB">
              <Input {...register("bank_details.bsb")} />
            </FormField>
            <FormField label="Account number">
              <Input {...register("bank_details.account_number")} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Legal & Warranty Text" description="Shown on the invoice footer." />
        <CardContent className="space-y-4">
          <FormField label="Warranty & returns text">
            <Textarea rows={3} {...register("warranty_text")} />
          </FormField>

          <FormField label="Legal disclaimer">
            <Textarea rows={3} {...register("legal_disclaimer_text")} />
          </FormField>
        </CardContent>
      </Card>
    </form>
  );
}
