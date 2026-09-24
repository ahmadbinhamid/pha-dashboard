import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SettingsTabBar } from "@/components/settings/SettingsTabBar";
import { ComingSoonPanel } from "@/components/settings/ComingSoonPanel";
import { AppearanceTab } from "@/components/settings/tabs/AppearanceTab";
import { StoreSettingsTab } from "@/components/settings/tabs/StoreSettingsTab";
import { IntegrationsTab } from "@/components/settings/tabs/IntegrationsTab";
// UsersTab/RolesTab exist but aren't wired up (available: false, see below).
import { SettingsHeaderActionsProvider } from "@/context/settingsHeaderActions";
import {
  DEFAULT_SETTINGS_TAB,
  DEFAULT_STORE_SECTION,
  findSettingsTab,
  findStoreSection,
  type SettingsTabId,
  type StoreSectionId,
} from "@/config/settingsTabs";
import type { IntegrationId } from "@/config/integrations";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { StickyPageHeader } from "@/components/shared/StickyPageHeader";

// Both nav levels live in the URL (/settings/:tab/:section): all linkable.
export default function SettingsPage() {
  const navigate = useNavigate();
  const { tab, section } = useParams<{ tab?: string; section?: string }>();

  // Tab forms portal their Save button here so it stays visible in the header.
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(null);

  const activeTab = findSettingsTab(tab) ?? findSettingsTab(DEFAULT_SETTINGS_TAB)!;
  const storeSection: StoreSectionId = findStoreSection(section)?.id ?? DEFAULT_STORE_SECTION;

  const { data, isLoading } = useQuery({ queryKey: ["tenant-settings"], queryFn: getTenantSettings });
  const settings = data?.data;

  const goToTab = (id: SettingsTabId) => navigate(`/settings/${id}`);

  return (
    <div className="space-y-6">
      {/* Title, portaled Save and tab bar stay pinned so Save never scrolls off. */}
      <StickyPageHeader className="z-20 space-y-4">
        <PageHeader
          title="Settings"
          description="Manage your store preferences, appearance & theme, integrations and system settings."
        >
          <div ref={setHeaderActionsEl} className="flex items-center gap-3" />
        </PageHeader>

        <SettingsTabBar activeId={activeTab.id} onSelect={goToTab} />
      </StickyPageHeader>

      <SettingsHeaderActionsProvider value={headerActionsEl}>
        {activeTab.id === "appearance" ? (
          <AppearanceTab settings={settings} loading={isLoading} />
        ) : activeTab.id === "store" ? (
          <StoreSettingsTab
            sectionId={storeSection}
            onSelectSection={(id) => navigate(`/settings/store/${id}`)}
            settings={settings}
            loading={isLoading}
          />
        ) : activeTab.id === "integrations" ? (
          <IntegrationsTab
            providerId={section as IntegrationId | undefined}
            onSelectProvider={(id) => navigate(id ? `/settings/integrations/${id}` : "/settings/integrations")}
            settings={settings}
          />
        ) : (
          <ComingSoonPanel title={activeTab.label} summary={activeTab.summary} planned={activeTab.planned} />
        )}
      </SettingsHeaderActionsProvider>

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs sm:flex-row">
        <div className="flex items-center gap-2 font-medium text-fg">
          <Lock className="h-4 w-4 shrink-0 text-accent" />
          <span>Settings are saved against your store and apply to everyone on the account.</span>
        </div>
        <div className="flex items-center gap-2 text-2xs font-semibold text-accent">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Changes take effect immediately</span>
        </div>
      </div>
    </div>
  );
}
