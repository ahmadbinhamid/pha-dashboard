import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Bundle } from "@/types";

type BundlesApi = {
  bundles: Bundle[];
  setBundles: (next: Bundle[]) => void;
  upsertBundle: (b: Bundle) => void;
  deleteBundle: (id: string) => void;
  reset: () => void;
};

const STORAGE_KEY = "pha-bundles";
const BundlesContext = createContext<BundlesApi | null>(null);

const SEED: Bundle[] = [
  {
    id: "bundle-service-basic",
    name: "Basic Service Bundle",
    items: [
      { sku: "PPG-OF-2201", qty: 1 },
      { sku: "PPG-SP-9007", qty: 4 },
    ],
    bundlePriceAud: 89.0,
    ebayTitle: "Service Bundle: Oil Filter + 4x Iridium Spark Plugs (Demo)",
    ebayCategory: "33559 — Automotive Filters",
    createdAt: new Date().toISOString(),
  },
];

function readStored(): Bundle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return SEED;
    return parsed as Bundle[];
  } catch {
    return SEED;
  }
}

export function BundlesProvider({ children }: { children: React.ReactNode }) {
  const [bundles, _setBundles] = useState<Bundle[]>(SEED);

  useEffect(() => {
    startTransition(() => _setBundles(readStored()));
  }, []);

  const persist = useCallback((next: Bundle[]) => {
    _setBundles(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const setBundles = useCallback((next: Bundle[]) => persist(next), [persist]);

  const upsertBundle = useCallback((b: Bundle) => {
    _setBundles((prev) => {
      const next = [b, ...prev.filter((x) => x.id !== b.id)];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const deleteBundle = useCallback((id: string) => {
    _setBundles((prev) => {
      const next = prev.filter((b) => b.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => persist(SEED), [persist]);

  const api = useMemo(
    () => ({ bundles, setBundles, upsertBundle, deleteBundle, reset }),
    [bundles, setBundles, upsertBundle, deleteBundle, reset],
  );

  return <BundlesContext.Provider value={api}>{children}</BundlesContext.Provider>;
}

export function useBundles() {
  const ctx = useContext(BundlesContext);
  if (!ctx) throw new Error("useBundles must be used within BundlesProvider");
  return ctx;
}
