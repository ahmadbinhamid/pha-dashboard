import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StringListField } from "@/components/ui/StringListField";
import { SettingsSection, SettingsFieldGrid } from "@/components/settings/SettingsSection";
import { useToast } from "@/context";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings } from "@/types/tenantSettings";

// Identity and contact details in two cards; both PATCH the same tenant-settings endpoint but send only their own fields, so saving trading hours can't clobber a just-edited ABN.
type GeneralState = {
  company_name: string;
  abn: string;
  email: string;
  phone: string;
  pickup_location: { name: string; address: string; country: string; trading_hours: string[] };
};

function toState(settings: TenantSettings): GeneralState {
  return {
    company_name: settings.company_name ?? "",
    abn: settings.abn ?? "",
    email: settings.email ?? "",
    phone: settings.phone ?? "",
    pickup_location: {
      name: settings.pickup_location?.name ?? "",
      address: settings.pickup_location?.address ?? "",
      country: settings.pickup_location?.country ?? "",
      trading_hours: settings.pickup_location?.trading_hours ?? [],
    },
  };
}

export function StoreGeneralSection({ settings, loading }: { settings?: TenantSettings; loading?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<GeneralState | null>(settings ? toState(settings) : null);

  useEffect(() => {
    if (settings) setForm(toState(settings));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast({ title: "Store profile saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save store profile", description: err.message, tone: "danger" }),
  });

  const set = <K extends keyof GeneralState>(key: K, value: GeneralState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  const setPickup = (patch: Partial<GeneralState["pickup_location"]>) =>
    setForm((f) => (f ? { ...f, pickup_location: { ...f.pickup_location, ...patch } } : f));

  const actions = (
    <>
      <Button variant="ghost" disabled={!settings || mutation.isPending} onClick={() => settings && setForm(toState(settings))}>
        Reset
      </Button>
      <Button variant="primary" disabled={!form || mutation.isPending} onClick={() => form && mutation.mutate(form)}>
        {mutation.isPending ? "Saving…" : "Save Store Profile"}
      </Button>
    </>
  );

  if (loading || !form) {
    return (
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Store Identity & Legal Entity"
        description="Primary trading profile, registered company details, and official Australian tax identifiers."
        right={
          form.abn.trim() ? (
            <Badge variant="ok" className="gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5" />
              ABN on file
            </Badge>
          ) : (
            <Badge variant="warn">ABN missing</Badge>
          )
        }
      >
        <SettingsFieldGrid>
          <FormField label="Store Display Name" hint="Displayed on customer receipts, storefront header and eBay listings.">
            <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </FormField>
          <FormField label="Australian Business Number (ABN)" hint="Printed on every tax invoice.">
            <Input value={form.abn} onChange={(e) => set("abn", e.target.value)} placeholder="12 345 678 901" />
          </FormField>
        </SettingsFieldGrid>
      </SettingsSection>

      <SettingsSection
        title="Customer Support & Trading Hours"
        description="Contact channels presented to auto mechanics, parts dealers, and retail buyers."
        footer={actions}
      >
        <div className="space-y-5">
          <SettingsFieldGrid>
            <FormField label="Customer Support Email">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </FormField>
            <FormField label="Parts Help Desk Phone">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </FormField>
          </SettingsFieldGrid>

          <SettingsFieldGrid>
            <FormField label="Pickup Location Name" hint="Shown as the heading on pickup-ready emails.">
              <Input value={form.pickup_location.name} onChange={(e) => setPickup({ name: e.target.value })} />
            </FormField>
            <FormField label="Pickup Country">
              <Input value={form.pickup_location.country} onChange={(e) => setPickup({ country: e.target.value })} />
            </FormField>
          </SettingsFieldGrid>

          <FormField label="Pickup Address" hint="Appears as the seller address on invoices and pickup emails.">
            <Input value={form.pickup_location.address} onChange={(e) => setPickup({ address: e.target.value })} />
          </FormField>

          <FormField label="Warehouse & Pickup Trading Hours" hint="One line per row, e.g. “Mon – Fri: 8:00 AM – 5:30 PM AEST”.">
            <StringListField
              values={form.pickup_location.trading_hours}
              onChange={(trading_hours) => setPickup({ trading_hours })}
              placeholder="Mon – Fri: 8:00 AM – 5:30 PM AEST"
            />
          </FormField>
        </div>
      </SettingsSection>
    </div>
  );
}
