import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { RichTextField } from "@/components/ui/RichTextField";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { useToast } from "@/context";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings } from "@/types/tenantSettings";

type PolicyState = { warranty_text: string; legal_disclaimer_text: string };

function toState(settings: TenantSettings): PolicyState {
  return {
    warranty_text: settings.warranty_text ?? "",
    legal_disclaimer_text: settings.legal_disclaimer_text ?? "",
  };
}

export function StorePoliciesSection({ settings, loading }: { settings?: TenantSettings; loading?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<PolicyState | null>(settings ? toState(settings) : null);

  useEffect(() => {
    if (settings) setForm(toState(settings));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast({ title: "Policies saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save policies", description: err.message, tone: "danger" }),
  });

  if (loading || !form) return <Skeleton className="h-96" />;

  return (
    <SettingsSection
      title="Fitment & Warranty Policies"
      description="Printed at the foot of every tax invoice, and shown to buyers before checkout."
      footer={
        <>
          <Button variant="ghost" disabled={!settings || mutation.isPending} onClick={() => settings && setForm(toState(settings))}>
            Reset
          </Button>
          <Button variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
            {mutation.isPending ? "Saving…" : "Save Policies"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Rich text, but the invoice can only set plain lines (pdfkit draws
            strings, not HTML), so formatting here is for the storefront and
            for authoring — headings, bold and bullets flatten to one line
            each on the printed invoice. See utils/richText.ts. */}
        <RichTextField
          label="Warranty & Returns"
          hint="One point per line or bullet. The invoice runs them together into a paragraph; the storefront keeps the formatting."
          value={form.warranty_text}
          onChange={(html) => setForm((f) => (f ? { ...f, warranty_text: html } : f))}
          placeholder="Returns are accepted within 30 days of purchase."
          minHeight="180px"
          disabled={mutation.isPending}
        />

        <RichTextField
          label="Legal Disclaimer"
          hint="Fitment liability and compatibility wording, shown verbatim."
          value={form.legal_disclaimer_text}
          onChange={(html) => setForm((f) => (f ? { ...f, legal_disclaimer_text: html } : f))}
          placeholder="Customers are responsible for confirming part compatibility before purchase."
          minHeight="180px"
          disabled={mutation.isPending}
        />
      </div>
    </SettingsSection>
  );
}
