"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ListingQueueStatus = "queued" | "published" | "error";
export type ListingQueueType = "bundle" | "product";

export type ListingQueueItem = {
  id: string;
  type: ListingQueueType;
  title: string;
  sku?: string;
  refId?: string;
  status: ListingQueueStatus;
  createdAt: string;
};

type ListingQueueApi = {
  items: ListingQueueItem[];
  enqueue: (item: Omit<ListingQueueItem, "id" | "createdAt" | "status">) => void;
  markPublished: (id: string) => void;
  markError: (id: string) => void;
  reset: () => void;
};

const STORAGE_KEY = "pha-ebay-listing-queue";
const Ctx = createContext<ListingQueueApi | null>(null);

function readStored(): ListingQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ListingQueueItem[];
  } catch {
    return [];
  }
}

export function ListingQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ListingQueueItem[]>([]);

  useEffect(() => {
    startTransition(() => setItems(readStored()));
  }, []);

  const persist = useCallback((next: ListingQueueItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const enqueue = useCallback((item: Omit<ListingQueueItem, "id" | "createdAt" | "status">) => {
    const newItem: ListingQueueItem = {
      ...item,
      id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => {
      const next = [newItem, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const markPublished = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, status: "published" as const } : i));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const markError = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, status: "error" as const } : i));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => persist([]), [persist]);

  const api = useMemo(() => ({ items, enqueue, markPublished, markError, reset }), [items, enqueue, markPublished, markError, reset]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useListingQueue() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListingQueue must be used within ListingQueueProvider");
  return ctx;
}

