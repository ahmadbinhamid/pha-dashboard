import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useToast } from "@/context/toast";
import type { AddCartItemInput, CartItem } from "@/types/cart";
import { addCartLine, removeCartLine, setCartLineNote, setCartLineQuantity } from "@/lib/cart/cartState";

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
    totalShipping: number; // dollars, per-unit freight x qty; delivery only
  };

const DataCtx = createContext<CartData | null>(null);
const ActionsCtx = createContext<CartActions | null>(null);

function isCartItem(row: unknown): row is CartItem {
  if (!row || typeof row !== "object") return false;
  const r = row as Partial<CartItem>;
  return (
    typeof r.key === "string" &&
    (typeof r.product_id === "string" || r.is_custom === true) &&
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
    // Older persisted carts lack newer fields; normalize rather than drop.
    return parsed.filter(isCartItem).map((i) => ({
      ...i,
      note: i.note ?? null,
      shipping_cost: i.shipping_cost ?? 0,
      is_custom: i.is_custom ?? false,
      default_discount: i.default_discount ?? null,
    }));
  } catch {
    return [];
  }
}

function persist(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* localStorage unavailable (private mode / quota); cart still works */
  }
}

// For callers outside CartProvider (logout, 401 interceptor).
export function clearCartStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Read at init: a mount effect shows an empty cart first and resets step 1.
  const [items, _setItems] = useState<CartItem[]>(readStored);
  const { toast } = useToast();

  const addItem = useCallback(
    (item: AddCartItemInput) => {
      if (!item.key || (!item.product_id && !item.is_custom) || !item.name) {
        toast({ title: "Couldn't add item", description: "This product is missing required data.", tone: "danger" });
        return;
      }
      let cappedAt: number | null = null;

      _setItems((prev) => {
        const result = addCartLine(prev, item);
        if (result.outOfStock) {
          toast({ title: "Out of stock", description: `${item.name} has no stock available.`, tone: "danger" });
          return prev;
        }
        cappedAt = result.cappedAt;
        persist(result.next);
        return result.next;
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
      const next = removeCartLine(prev, key);
      persist(next);
      return next;
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    _setItems((prev) => {
      const next = setCartLineQuantity(prev, key, quantity);
      persist(next);
      return next;
    });
  }, []);

  const setItemNote = useCallback((key: string, note: string) => {
    _setItems((prev) => {
      const next = setCartLineNote(prev, key, note);
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
  const totalShipping = items.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0);
  return { items, totalItems, totalPrice, totalShipping, ...actions };
}
