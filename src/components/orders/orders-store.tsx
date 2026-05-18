"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ORDERS, type Order } from "@/lib/data/orders";

type OrdersApi = {
  orders: Order[];
  setOrders: (next: Order[]) => void;
  appendOrder: (o: Order) => void;
  reset: () => void;
};

const STORAGE_KEY = "pha-orders";
const OrdersContext = createContext<OrdersApi | null>(null);

function readStored(): Order[] {
  if (typeof window === "undefined") return ORDERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ORDERS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ORDERS;
    return parsed as Order[];
  } catch {
    return ORDERS;
  }
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, _setOrders] = useState<Order[]>(ORDERS);

  useEffect(() => {
    startTransition(() => _setOrders(readStored()));
  }, []);

  const persist = useCallback((next: Order[]) => {
    _setOrders(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setOrders = useCallback((next: Order[]) => persist(next), [persist]);

  const appendOrder = useCallback(
    (o: Order) => {
      persist([o, ...orders]);
    },
    [orders, persist],
  );

  const reset = useCallback(() => persist(ORDERS), [persist]);

  const api = useMemo(() => ({ orders, setOrders, appendOrder, reset }), [orders, setOrders, appendOrder, reset]);

  return <OrdersContext.Provider value={api}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}

