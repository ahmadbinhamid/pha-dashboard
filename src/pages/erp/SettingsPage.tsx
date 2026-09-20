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
import { ActivityTab } from "@/components/settings/tabs/ActivityTab";
// UsersTab/RolesTab are fully built but not wired up right now — see
// config/settingsTabs.tsx's comment on "users"/"roles" for why. Both tabs
// fall through to the generic `available: false` branch below instead.
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

// Settings as a full page (it used to be a bottom-sheet overlay): a header,
// one horizontal tab bar, and the active tab's own body. Both levels of
// navigation live in the URL — /settings/:tab and, for tabs that have a
// second level, /settings/:tab/:section — so every screen here is linkable
// and survives a refresh.
export default function SettingsPage() {
  const navigate = useNavigate();
  const { tab, section } = useParams<{ tab?: string; section?: string }>();

  // Forms inside the tabs (eBay, Stripe, SMTP) render their Save button into
  // the page header through this portal target, which is what keeps the action
  // visible without each panel growing its own action row.
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(null);

  const activeTab = findSettingsTab(tab) ?? findSettingsTab(DEFAULT_SETTINGS_TAB)!;
  const storeSection: StoreSectionId = findStoreSection(section)?.id ?? DEFAULT_STORE_SECTION;

  const { data, isLoading } = useQuery({ queryKey: ["tenant-settings"], queryFn: getTenantSettings });
  const settings = data?.data;

  const goToTab = (id: SettingsTabId) => navigate(`/settings/${id}`);

  return (
    <div className="-mt-section space-y-6">
      {/* Title, header actions and tab bar pin to the top of AppShell's scroll
          container as one block. The tab bar staying reachable is half of it;
          the other half is the action slot below — the eBay/Stripe/SMTP forms
          portal their Save button into it (see SettingsHeaderActions), and a
          Save that scrolls off on a long form is the thing the old settings
          sheet used a sticky header to avoid.

          The negative margins cancel the page gutter so the opaque background
          reaches the edges, instead of letting cards show through beside it
          as they scroll under. -top-section is the same idea vertically:
          sticky pins against the scroll container's PADDING box, so at top-0
          the shell's py-section left a band above the header that content
          scrolled visibly through — offsetting by that padding tucks the
          block's own pt-section above the fold instead. */}
      <div className="sticky -top-section z-20 -mx-4 space-y-4 bg-bg px-4 pt-section sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <PageHeader
          title="Settings"
          description="Manage your store preferences, appearance & theme, integrations and system settings."
        >
          <div ref={setHeaderActionsEl} className="flex items-center gap-3" />
        </PageHeader>

        <SettingsTabBar activeId={activeTab.id} onSelect={goToTab} />
      </div>

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
        ) : activeTab.id === "activity" ? (
          <ActivityTab />
        ) : (
          <ComingSoonPanel title={activeTab.label} summary={activeTab.summary} planned={activeTab.planned} />
        )}
      </SettingsHeaderActionsProvider>

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs sm:flex-row">
        <div className="flex items-center gap-2 font-medium text-fg">
          <Lock className="h-4 w-4 shrink-0 text-accent" />
          <span>Settings are saved against your store and apply to everyone on the account.</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-accent">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Changes take effect immediately</span>
        </div>
      </div>
    </div>
  );
}
