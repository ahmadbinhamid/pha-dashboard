import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { CompanyProfileForm, COMPANY_PROFILE_FORM_ID } from "@/components/tenant-settings/CompanyProfileForm";
import { getTenantSettings } from "@/lib/api/tenantSettings";

export default function BusinessInfoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });
  const settings = data?.data;

  const [mutationState, setMutationState] = useState({ isPending: false, isSuccess: false, error: null as string | null });

  return (
    <div className="space-y-6">
      <PageHeader title="Business Information" description="Shown on invoices, receipts, and customer emails." />

      <SettingsHeaderActions>
        <SaveStatusText isSuccess={mutationState.isSuccess} error={mutationState.error} />
        <Button type="submit" form={COMPANY_PROFILE_FORM_ID} disabled={!settings || mutationState.isPending}>
          {mutationState.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>

      {isLoading || !settings ? (
        <SkeletonCard />
      ) : (
        <CompanyProfileForm settings={settings} onMutationStateChange={setMutationState} />
      )}
    </div>
  );
}
