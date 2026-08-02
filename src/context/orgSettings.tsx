import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrgSettings } from "@/types";
import { useAuth } from "@/context/auth";
import { getTenantSettings } from "@/lib/api/tenantSettings";

const FALLBACK: OrgSettings = {
  storeName: "",
  logoUrl: null,
};

type OrgSettingsApi = {
  settings: OrgSettings;
  isLoading: boolean;
};

const OrgSettingsContext = createContext<OrgSettingsApi | null>(null);

// Backed by the authenticated user's own Tenant record (Settings → Business
// Info) — replaces the old localStorage-only mock, which meant every tenant
// saw the same hardcoded "Parts Hub Australia" name/logo in the sidebar
// regardless of who was actually logged in. Only fetched once authenticated:
// pre-login there is no tenant context yet (see AppLogoMark for that screen).
export function OrgSettingsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
    enabled: isAuthenticated,
  });

  const tenant = data?.data;
  const settings: OrgSettings = useMemo(
    () => ({
      storeName: tenant?.company_name || tenant?.name || FALLBACK.storeName,
      logoUrl: tenant?.logo_url ?? FALLBACK.logoUrl,
    }),
    [tenant],
  );

  const api = useMemo(() => ({ settings, isLoading }), [settings, isLoading]);

  return <OrgSettingsContext.Provider value={api}>{children}</OrgSettingsContext.Provider>;
}

export function useOrgSettings() {
  const ctx = useContext(OrgSettingsContext);
  if (!ctx) throw new Error("useOrgSettings must be used within OrgSettingsProvider");
  return ctx;
}
