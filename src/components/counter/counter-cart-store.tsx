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

type CounterCartApi = {
  customer: CounterCustomer;
  setCustomer: (c: CounterCustomer) => void;
  saleType: CounterSaleType;
  setSaleType: (t: CounterSaleType) => void;
  fulfilment: CounterFulfilment;
  setFulfilment: (f: CounterFulfilment) => void;
  lines: CounterCartLine[];
  addLine: (line: Omit<CounterCartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "pha-counter-cart";
const Ctx = createContext<CounterCartApi | null>(null);

type Stored = {
  customer: CounterCustomer;
  saleType: CounterSaleType;
  fulfilment: CounterFulfilment;
  lines: CounterCartLine[];
};

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

export function CounterCartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(DEFAULTS);

  useEffect(() => {
    startTransition(() => setState(readStored()));
  }, []);

  const persist = useCallback((next: Stored) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setCustomer = useCallback((c: CounterCustomer) => persist({ ...state, customer: c }), [persist, state]);
  const setSaleType = useCallback((t: CounterSaleType) => persist({ ...state, saleType: t }), [persist, state]);
  const setFulfilment = useCallback(
    (f: CounterFulfilment) => persist({ ...state, fulfilment: f }),
    [persist, state],
  );

  const addLine = useCallback(
    (line: Omit<CounterCartLine, "qty">, qty = 1) => {
      const q = clampQty(qty);
      const existing = state.lines.find((l) => l.productId === line.productId);
      const lines = existing
        ? state.lines.map((l) => (l.productId === line.productId ? { ...l, qty: l.qty + q } : l))
        : [...state.lines, { ...line, qty: q }];
      persist({ ...state, lines });
    },
    [persist, state],
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      const q = clampQty(qty);
      persist({ ...state, lines: state.lines.map((l) => (l.productId === productId ? { ...l, qty: q } : l)) });
    },
    [persist, state],
  );

  const removeLine = useCallback(
    (productId: string) => persist({ ...state, lines: state.lines.filter((l) => l.productId !== productId) }),
    [persist, state],
  );

  const clear = useCallback(() => persist(DEFAULTS), [persist]);

  const api = useMemo(
    () => ({
      customer: state.customer,
      setCustomer,
      saleType: state.saleType,
      setSaleType,
      fulfilment: state.fulfilment,
      setFulfilment,
      lines: state.lines,
      addLine,
      setQty,
      removeLine,
      clear,
    }),
    [state, setCustomer, setSaleType, setFulfilment, addLine, setQty, removeLine, clear],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCounterCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCounterCart must be used within CounterCartProvider");
  return ctx;
}

