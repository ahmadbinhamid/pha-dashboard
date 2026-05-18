"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { INVENTORY, type InventoryItem } from "@/lib/data/inventory";

type InventoryState = InventoryItem[];

type InventoryApi = {
  items: InventoryState;
  setItems: (items: InventoryState) => void;
  updateStock: (id: string, nextStock: number) => void;
  deductStock: (lines: Array<{ id: string; qty: number }>) => void;
  reset: () => void;
};

const STORAGE_KEY = "ppg-inventory";
const InventoryContext = createContext<InventoryApi | null>(null);

function mergeStoredRow(row: unknown): InventoryItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Partial<InventoryItem> & { id?: unknown };
  if (typeof r.id !== "string") return null;
  const base = INVENTORY.find((i) => i.id === r.id);
  if (base) {
    return {
      ...base,
      ...r,
      make: typeof r.make === "string" ? r.make : base.make,
      model: typeof r.model === "string" ? r.model : base.model,
      yearFrom: typeof r.yearFrom === "number" ? r.yearFrom : base.yearFrom,
      yearTo: typeof r.yearTo === "number" ? r.yearTo : base.yearTo,
      stock: typeof r.stock === "number" ? r.stock : base.stock,
      price: typeof r.price === "number" ? r.price : base.price,
      cost: typeof r.cost === "number" ? r.cost : base.cost,
      category: typeof r.category === "string" ? r.category : base.category,
      title: typeof r.title === "string" ? r.title : base.title,
      sku: typeof r.sku === "string" ? r.sku : base.sku,
      ebay: r.ebay ?? base.ebay,
      image: r.image && typeof r.image === "object" ? r.image : base.image,
      imageUrl: typeof r.imageUrl === "string" && r.imageUrl.trim() ? r.imageUrl : base.imageUrl,
      galleryUrls: Array.isArray(r.galleryUrls) && r.galleryUrls.length
        ? (r.galleryUrls as unknown[]).filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
        : base.galleryUrls,
    };
  }
  if (typeof r.sku !== "string" || typeof r.title !== "string") return null;
  return {
    ...(r as InventoryItem),
    make: typeof r.make === "string" ? r.make : "",
    model: typeof r.model === "string" ? r.model : "",
    yearFrom: typeof r.yearFrom === "number" ? r.yearFrom : 1900,
    yearTo: typeof r.yearTo === "number" ? r.yearTo : 2100,
  };
}

function readStored(): InventoryState {
  if (typeof window === "undefined") return INVENTORY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INVENTORY;
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return INVENTORY;
    const merged = parsed.map(mergeStoredRow).filter((x): x is InventoryItem => x !== null);
    return merged.length ? merged : INVENTORY;
  } catch {
    return INVENTORY;
  }
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [items, _setItems] = useState<InventoryState>(INVENTORY);

  useEffect(() => {
    startTransition(() => {
      _setItems(readStored());
    });
  }, []);

  const persist = useCallback((next: InventoryState) => {
    _setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const setItems = useCallback((next: InventoryState) => persist(next), [persist]);

  const updateStock = useCallback(
    (id: string, nextStock: number) => {
      persist(items.map((p) => (p.id === id ? { ...p, stock: Math.max(0, nextStock) } : p)));
    },
    [items, persist],
  );

  const deductStock = useCallback(
    (lines: Array<{ id: string; qty: number }>) => {
      const byId = new Map(lines.map((l) => [l.id, l.qty]));
      persist(
        items.map((p) => {
          const qty = byId.get(p.id);
          if (!qty) return p;
          return { ...p, stock: Math.max(0, p.stock - qty) };
        }),
      );
    },
    [items, persist],
  );

  const reset = useCallback(() => persist(INVENTORY), [persist]);

  const api = useMemo(
    () => ({ items, setItems, updateStock, deductStock, reset }),
    [items, setItems, updateStock, deductStock, reset],
  );

  return <InventoryContext.Provider value={api}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}

