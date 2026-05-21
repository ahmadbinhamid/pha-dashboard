import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CounterCartData, CounterCartActions, CounterCartApi, CounterCustomer, CounterCartLine } from "@/types";
import type { SaleType, FulfilmentType } from "@/types";

const STORAGE_KEY = "pha-counter-cart";

type Stored = CounterCartData;

const DEFAULTS: Stored = {
  customer: { name: "" },
  saleType: "walk_in",
  fulfilment: "pickup",
  lines: [],
};

function clampQty(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.trunc(n)));
}

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      customer: parsed.customer ?? DEFAULTS.customer,
      saleType: (parsed.saleType as SaleType) ?? DEFAULTS.saleType,
      fulfilment: (parsed.fulfilment as FulfilmentType) ?? DEFAULTS.fulfilment,
      lines: Array.isArray(parsed.lines) ? (parsed.lines as CounterCartLine[]) : [],
    };
  } catch {
    return DEFAULTS;
  }
}

const DataCtx = createContext<CounterCartData | null>(null);
const ActionsCtx = createContext<CounterCartActions | null>(null);

export function CounterCartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(DEFAULTS);

  useEffect(() => {
    startTransition(() => setState(readStored()));
  }, []);

  const setCustomer = useCallback((c: CounterCustomer) => {
    setState((prev) => {
      const next = { ...prev, customer: c };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setSaleType = useCallback((t: SaleType) => {
    setState((prev) => {
      const next = { ...prev, saleType: t };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setFulfilment = useCallback((f: FulfilmentType) => {
    setState((prev) => {
      const next = { ...prev, fulfilment: f };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addLine = useCallback((line: Omit<CounterCartLine, "qty">, qty = 1) => {
    const q = clampQty(qty);
    setState((prev) => {
      const existing = prev.lines.find((l) => l.productId === line.productId);
      const lines = existing
        ? prev.lines.map((l) => (l.productId === line.productId ? { ...l, qty: l.qty + q } : l))
        : [...prev.lines, { ...line, qty: q }];
      const next = { ...prev, lines };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    const q = clampQty(qty);
    setState((prev) => {
      const next = { ...prev, lines: prev.lines.map((l) => (l.productId === productId ? { ...l, qty: q } : l)) };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setState((prev) => {
      const next = { ...prev, lines: prev.lines.filter((l) => l.productId !== productId) };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setState(DEFAULTS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS)); } catch {}
  }, []);

  const actions = useMemo<CounterCartActions>(
    () => ({ setCustomer, setSaleType, setFulfilment, addLine, setQty, removeLine, clear }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const data = useMemo<CounterCartData>(
    () => ({ customer: state.customer, saleType: state.saleType, fulfilment: state.fulfilment, lines: state.lines }),
    [state],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <DataCtx.Provider value={data}>
        {children}
      </DataCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useCounterCartData(): CounterCartData {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useCounterCartData must be used within CounterCartProvider");
  return ctx;
}

export function useCounterCartActions(): CounterCartActions {
  const ctx = useContext(ActionsCtx);
  if (!ctx) throw new Error("useCounterCartActions must be used within CounterCartProvider");
  return ctx;
}

export function useCounterCart(): CounterCartApi {
  return { ...useCounterCartData(), ...useCounterCartActions() };
}
