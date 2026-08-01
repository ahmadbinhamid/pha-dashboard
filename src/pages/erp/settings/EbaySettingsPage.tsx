import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { EbayConnectCard } from "@/components/ebay-settings/EbayConnectCard";
import { EbaySettingsForm, EBAY_SETTINGS_FORM_ID } from "@/components/ebay-settings/EbaySettingsForm";
import { getEbaySettings } from "@/lib/api/ebay";

export default function EbaySettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ebay-settings"],
    queryFn: getEbaySettings,
  });
  const settings = data?.data;

  const [mutationState, setMutationState] = useState({ isPending: false, isSuccess: false, error: null as string | null });

  return (
    <div className="space-y-6">
      <PageHeader title="eBay Integration" description="Connect a seller account and configure listing defaults." />

      <SettingsHeaderActions>
        <SaveStatusText isSuccess={mutationState.isSuccess} error={mutationState.error} />
        <Button type="submit" form={EBAY_SETTINGS_FORM_ID} disabled={!settings || mutationState.isPending}>
          {mutationState.isPending ? "Saving…" : "Save changes"}
        </Button>
      </SettingsHeaderActions>

      <EbayConnectCard />

      {isLoading || !settings ? (
        <SkeletonCard />
      ) : (
        <EbaySettingsForm settings={settings} onMutationStateChange={setMutationState} />
      )}
    </div>
  );
}
