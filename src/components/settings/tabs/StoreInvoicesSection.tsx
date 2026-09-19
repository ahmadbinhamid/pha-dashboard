import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsSection, SettingsFieldGrid } from "@/components/settings/SettingsSection";
import { useToast } from "@/context";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings } from "@/types/tenantSettings";

type InvoiceState = {
  order_number_prefix: string;
  invoice_number_prefix: string;
  bank_details: { bank_name: string; account_name: string; bsb: string; account_number: string };
};

function toState(settings: TenantSettings): InvoiceState {
  return {
    order_number_prefix: settings.order_number_prefix ?? "ORD",
    invoice_number_prefix: settings.invoice_number_prefix ?? "INV",
    bank_details: {
      bank_name: settings.bank_details?.bank_name ?? "",
      account_name: settings.bank_details?.account_name ?? "",
      bsb: settings.bank_details?.bsb ?? "",
      account_number: settings.bank_details?.account_number ?? "",
    },
  };
}

export function StoreInvoicesSection({ settings, loading }: { settings?: TenantSettings; loading?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<InvoiceState | null>(settings ? toState(settings) : null);

  useEffect(() => {
    if (settings) setForm(toState(settings));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast({ title: "Invoice settings saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save invoice settings", description: err.message, tone: "danger" }),
  });

  const setBank = (patch: Partial<InvoiceState["bank_details"]>) =>
    setForm((f) => (f ? { ...f, bank_details: { ...f.bank_details, ...patch } } : f));

  if (loading || !form) {
    return (
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Document Numbering"
        description="Prefixes for new orders and tax invoices. Letters and digits only — the dash before the number is added automatically."
      >
        <SettingsFieldGrid>
          <FormField
            label="Order Number Prefix"
            hint="Only affects orders created from now on — past orders keep the prefix they were created under."
          >
            <Input
              value={form.order_number_prefix}
              onChange={(e) => setForm((f) => (f ? { ...f, order_number_prefix: e.target.value } : f))}
              placeholder="ORD"
            />
          </FormField>
          <FormField label="Invoice Number Prefix" hint="Shown as e.g. INV-00076 on the tax invoice.">
            <Input
              value={form.invoice_number_prefix}
              onChange={(e) => setForm((f) => (f ? { ...f, invoice_number_prefix: e.target.value } : f))}
              placeholder="INV"
            />
          </FormField>
        </SettingsFieldGrid>
      </SettingsSection>

      <SettingsSection
        title="Remittance & Bank Details"
        description="Printed in the Payment Details block on every tax invoice and docket."
        footer={
          <>
            <Button variant="ghost" disabled={!settings || mutation.isPending} onClick={() => settings && setForm(toState(settings))}>
              Reset
            </Button>
            <Button variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
              {mutation.isPending ? "Saving…" : "Save Invoice Settings"}
            </Button>
          </>
        }
      >
        <SettingsFieldGrid>
          <FormField label="Bank Name">
            <Input value={form.bank_details.bank_name} onChange={(e) => setBank({ bank_name: e.target.value })} />
          </FormField>
          <FormField label="Account Name">
            <Input value={form.bank_details.account_name} onChange={(e) => setBank({ account_name: e.target.value })} />
          </FormField>
          <FormField label="BSB">
            <Input value={form.bank_details.bsb} onChange={(e) => setBank({ bsb: e.target.value })} placeholder="083-004" />
          </FormField>
          <FormField label="Account Number">
            <Input value={form.bank_details.account_number} onChange={(e) => setBank({ account_number: e.target.value })} />
          </FormField>
        </SettingsFieldGrid>
      </SettingsSection>
    </div>
  );
}
