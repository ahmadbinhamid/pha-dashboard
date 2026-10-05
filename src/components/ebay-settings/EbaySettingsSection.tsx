import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Can } from "@/components/auth/Can";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { SettingsHeaderActions } from "@/context/settingsHeaderActions";
import { EbaySettingsForm, EBAY_SETTINGS_FORM_ID } from "@/components/ebay-settings/EbaySettingsForm";
import { PERMISSIONS } from "@/config/permissions";
import { getEbaySettings } from "@/lib/api/ebay";
import type { SettingsMutationState } from "@/types/tenantSettings";

const IDLE: SettingsMutationState = { isPending: false, isSuccess: false, error: null };

// eBay's settings form, saved from the settings page header.
export function EbaySettingsSection() {
  const { data, isLoading } = useQuery({ queryKey: ["ebay-settings"], queryFn: getEbaySettings });
  const settings = data?.data;
  const [state, setState] = useState<SettingsMutationState>(IDLE);

  return (
    <>
      <SettingsHeaderActions>
        <SaveStatusText isSuccess={state.isSuccess} error={state.error} />
        <Can permission={PERMISSIONS.integrations.update}>
          <Button type="submit" form={EBAY_SETTINGS_FORM_ID} disabled={!settings || state.isPending}>
            {state.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Can>
      </SettingsHeaderActions>
      {isLoading || !settings ? <SkeletonCard /> : <EbaySettingsForm settings={settings} onMutationStateChange={setState} />}
    </>
  );
}
