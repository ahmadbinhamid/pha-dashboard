import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Order } from "@/types";
import { ORDERS } from "@/lib/data/orders";

type OrdersApi = {
  orders: Order[];
  setOrders: (next: Order[]) => void;
  appendOrder: (o: Order) => void;
  reset: () => void;
};

const STORAGE_KEY = "pha-orders";
const OrdersContext = createContext<OrdersApi | null>(null);

function readStored(): Order[] {
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const setOrders = useCallback((next: Order[]) => persist(next), [persist]);

  const appendOrder = useCallback((o: Order) => {
    _setOrders((prev) => {
      const next = [o, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => persist(ORDERS), [persist]);

  const api = useMemo(() => ({ orders, setOrders, appendOrder, reset }), [orders, setOrders, appendOrder, reset]);

  return <OrdersContext.Provider value={api}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
