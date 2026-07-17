import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { OrgSettings } from "@/types";

const DEFAULTS: OrgSettings = {
  storeName: "Parts Hub Australia",
  displayName: "Avery Chen",
  location: "Campbellfield",
  currency: "AUD",
  abn: "00 000 000 000",
  invoicePrefix: "PHA",
  nextInvoiceNumber: 10520,
};

const STORAGE_KEY = "ppg-org-settings";

type OrgSettingsApi = {
  settings: OrgSettings;
  update: (patch: Partial<OrgSettings>) => void;
  reset: () => void;
};

const OrgSettingsContext = createContext<OrgSettingsApi | null>(null);

function readStored(): OrgSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<OrgSettings>;
    return { ...DEFAULTS, ...parsed, currency: "AUD" };
  } catch {
    return DEFAULTS;
  }
}

export function OrgSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<OrgSettings>(DEFAULTS);

  useEffect(() => {
    startTransition(() => {
      setSettings(readStored());
    });
  }, []);

  const update = useCallback((patch: Partial<OrgSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch, currency: "AUD" as const };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULTS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS)); } catch {}
  }, []);

  const api = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);

  return <OrgSettingsContext.Provider value={api}>{children}</OrgSettingsContext.Provider>;
}

export function useOrgSettings() {
  const ctx = useContext(OrgSettingsContext);
  if (!ctx) throw new Error("useOrgSettings must be used within OrgSettingsProvider");
  return ctx;
}
