"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CounterCustomer = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type CounterCartLine = {
  productId: string;
  sku: string;
  title: string;
  qty: number;
  unitPriceInclGst: number;
};

export type CounterSaleType = "walk_in" | "online" | "ebay";
export type CounterFulfilment = "pickup" | "delivery";

export type CounterCartData = {
  customer: CounterCustomer;
  saleType: CounterSaleType;
  fulfilment: CounterFulfilment;
  lines: CounterCartLine[];
};

export type CounterCartActions = {
  setCustomer: (c: CounterCustomer) => void;
  setSaleType: (t: CounterSaleType) => void;
  setFulfilment: (f: CounterFulfilment) => void;
  addLine: (line: Omit<CounterCartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
};

// Kept for backward compat — components that need both can still use useCounterCart()
export type CounterCartApi = CounterCartData & CounterCartActions;

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
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      customer: parsed.customer ?? DEFAULTS.customer,
      saleType: (parsed.saleType as CounterSaleType) ?? DEFAULTS.saleType,
      fulfilment: (parsed.fulfilment as CounterFulfilment) ?? DEFAULTS.fulfilment,
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

  // All callbacks are stable — empty deps, use functional setState to read latest value
  const setCustomer = useCallback((c: CounterCustomer) => {
    setState((prev) => {
      const next = { ...prev, customer: c };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setSaleType = useCallback((t: CounterSaleType) => {
    setState((prev) => {
      const next = { ...prev, saleType: t };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setFulfilment = useCallback((f: CounterFulfilment) => {
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

  // Actions object is stable — created once, never changes (all callbacks have empty deps)
  const actions = useMemo<CounterCartActions>(
    () => ({ setCustomer, setSaleType, setFulfilment, addLine, setQty, removeLine, clear }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Data object only changes when state changes
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

// Backward-compat — re-renders when either data or actions change
// Prefer useCounterCartData() / useCounterCartActions() for better perf
export function useCounterCart(): CounterCartApi {
  return { ...useCounterCartData(), ...useCounterCartActions() };
}
