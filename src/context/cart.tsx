import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useToast } from "@/context/toast";
import type { AddCartItemInput, CartItem } from "@/types/cart";

const STORAGE_KEY = "pha-dashboard-pos-cart";

export type CartData = { items: CartItem[] };

export type CartActions = {
  addItem: (item: AddCartItemInput) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  setItemNote: (key: string, note: string) => void;
  clearCart: () => void;
};

export type CartApi = CartData &
  CartActions & {
    totalItems: number;
    totalPrice: number; // dollars
  };

const DataCtx = createContext<CartData | null>(null);
const ActionsCtx = createContext<CartActions | null>(null);

function isCartItem(row: unknown): row is CartItem {
  if (!row || typeof row !== "object") return false;
  const r = row as Partial<CartItem>;
  return (
    typeof r.key === "string" &&
    typeof r.product_id === "string" &&
    typeof r.name === "string" &&
    typeof r.unit_price === "number" &&
    typeof r.quantity === "number" &&
    r.quantity > 0
  );
}

function readStored(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // `note` predates this field on carts persisted before it was added —
    // normalize rather than drop those items.
    return parsed.filter(isCartItem).map((i) => ({ ...i, note: i.note ?? null }));
  } catch {
    return [];
  }
}

function persist(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* localStorage unavailable (private mode / quota) — cart still works for this tab */
  }
}

// For use outside the CartProvider tree (logout, 401 interceptor) where
// there's no `clearCart()` action available to update in-memory state too.
export function clearCartStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function clamp(quantity: number, max: number | null) {
  return max != null ? Math.min(quantity, max) : quantity;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, _setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    startTransition(() => {
      _setItems(readStored());
    });
  }, []);

  const addItem = useCallback(
    (item: AddCartItemInput) => {
      if (!item.key || !item.product_id || !item.name) {
        toast({ title: "Couldn't add item", description: "This product is missing required data.", tone: "danger" });
        return;
      }
      const requestedQty = item.quantity ?? 1;
      let cappedAt: number | null = null;

      _setItems((prev) => {
        const existing = prev.find((i) => i.key === item.key);
        let next: CartItem[];

        if (existing) {
          const combined = existing.quantity + requestedQty;
          const quantity = clamp(combined, existing.max_quantity);
          if (existing.max_quantity != null && quantity < combined) cappedAt = existing.max_quantity;
          next = prev.map((i) => (i.key === item.key ? { ...i, quantity } : i));
        } else {
          const max = item.max_quantity ?? null;
          const quantity = clamp(requestedQty, max);
          if (max != null && quantity < requestedQty) cappedAt = max;
          if (quantity <= 0) {
            toast({ title: "Out of stock", description: `${item.name} has no stock available.`, tone: "danger" });
            return prev;
          }
          next = [...prev, { ...item, note: item.note ?? null, quantity }];
        }

        persist(next);
        return next;
      });

      if (cappedAt != null) {
        toast({
          title: "Stock limit reached",
          description: `Only ${cappedAt} in stock — quantity capped at maximum available.`,
          tone: "warning",
        });
      }
    },
    [toast],
  );

  const removeItem = useCallback((key: string) => {
    _setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      persist(next);
      return next;
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    _setItems((prev) => {
      if (quantity <= 0) {
        const next = prev.filter((i) => i.key !== key);
        persist(next);
        return next;
      }
      const next = prev.map((i) =>
        i.key === key ? { ...i, quantity: clamp(quantity, i.max_quantity) } : i,
      );
      persist(next);
      return next;
    });
  }, []);

  const setItemNote = useCallback((key: string, note: string) => {
    _setItems((prev) => {
      const next = prev.map((i) => (i.key === key ? { ...i, note: note.trim() || null } : i));
      persist(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    _setItems([]);
    persist([]);
  }, []);

  const actions = useMemo<CartActions>(
    () => ({ addItem, removeItem, setQuantity, setItemNote, clearCart }),
    [addItem, removeItem, setQuantity, setItemNote, clearCart],
  );

  const data = useMemo<CartData>(() => ({ items }), [items]);

  return (
    <ActionsCtx.Provider value={actions}>
      <DataCtx.Provider value={data}>{children}</DataCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useCartData(): CartData {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useCartData must be used within CartProvider");
  return ctx;
}

export function useCartActions(): CartActions {
  const ctx = useContext(ActionsCtx);
  if (!ctx) throw new Error("useCartActions must be used within CartProvider");
  return ctx;
}

export function useCart(): CartApi {
  const { items } = useCartData();
  const actions = useCartActions();
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  return { items, totalItems, totalPrice, ...actions };
}
