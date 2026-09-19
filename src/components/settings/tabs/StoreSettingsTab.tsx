import { useQuery } from "@tanstack/react-query";
import { SettingsSubTabs } from "@/components/settings/SettingsSubTabs";
import { ComingSoonPanel } from "@/components/settings/ComingSoonPanel";
import { StoreGeneralSection } from "@/components/settings/tabs/StoreGeneralSection";
import { StoreInvoicesSection } from "@/components/settings/tabs/StoreInvoicesSection";
import { StorePoliciesSection } from "@/components/settings/tabs/StorePoliciesSection";
import { StoreWarehousesSection } from "@/components/settings/tabs/StoreWarehousesSection";
import { findStoreSection, type StoreSectionId } from "@/config/settingsTabs";
import { getLocations } from "@/lib/api/locations";
import type { TenantSettings } from "@/types/tenantSettings";

// Store Settings is the only tab with a second level of navigation. The
// section lives in the URL (/settings/store/:section) rather than local state,
// so a section is linkable and survives a refresh like every other tab.
export function StoreSettingsTab({
  sectionId,
  onSelectSection,
  settings,
  loading,
}: {
  sectionId: StoreSectionId;
  onSelectSection: (id: StoreSectionId) => void;
  settings?: TenantSettings;
  loading?: boolean;
}) {
  // Only for the pill's count badge — the section itself refetches through the
  // same query key, so this doesn't cause a second request.
  const { data: locationsRes } = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const section = findStoreSection(sectionId);

  return (
    <div className="space-y-6">
      <SettingsSubTabs
        activeId={sectionId}
        onSelect={onSelectSection}
        counts={{ warehouses: locationsRes?.data?.length }}
      />

      {sectionId === "general" ? (
        <StoreGeneralSection settings={settings} loading={loading} />
      ) : sectionId === "warehouses" ? (
        <StoreWarehousesSection />
      ) : sectionId === "invoices" ? (
        <StoreInvoicesSection settings={settings} loading={loading} />
      ) : sectionId === "policies" ? (
        <StorePoliciesSection settings={settings} loading={loading} />
      ) : (
        <ComingSoonPanel title={section?.label ?? "Coming soon"} summary={section?.summary} planned={section?.planned} />
      )}
    </div>
  );
}
