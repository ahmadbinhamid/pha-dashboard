import type { AddCartItemInput, CartItem } from "@/types/cart";

// NOTE: React-free so node:test can run it; no test dependencies are allowed.

export interface AddCartLineResult {
  next: CartItem[];
  // Set when the requested quantity was clamped to max_quantity.
  cappedAt: number | null;
  outOfStock: boolean;
}

function clamp(quantity: number, max: number | null) {
  return max != null ? Math.min(quantity, max) : quantity;
}

export function addCartLine(prev: CartItem[], item: AddCartItemInput): AddCartLineResult {
  const requestedQty = item.quantity ?? 1;
  const existing = prev.find((i) => i.key === item.key);

  if (existing) {
    const combined = existing.quantity + requestedQty;
    const quantity = clamp(combined, existing.max_quantity);
    const cappedAt = existing.max_quantity != null && quantity < combined ? existing.max_quantity : null;
    return { next: prev.map((i) => (i.key === item.key ? { ...i, quantity } : i)), cappedAt, outOfStock: false };
  }

  const max = item.max_quantity ?? null;
  const quantity = clamp(requestedQty, max);
  if (quantity <= 0) return { next: prev, cappedAt: null, outOfStock: true };
  const line: CartItem = {
    ...item,
    note: item.note ?? null,
    is_custom: item.is_custom ?? false,
    default_discount: item.default_discount ?? null,
    quantity,
  };
  return { next: [...prev, line], cappedAt: max != null && quantity < requestedQty ? max : null, outOfStock: false };
}

export function removeCartLine(prev: CartItem[], key: string): CartItem[] {
  return prev.filter((i) => i.key !== key);
}

// A quantity of 0 or less removes the line, matching the stepper's minus.
export function setCartLineQuantity(prev: CartItem[], key: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeCartLine(prev, key);
  return prev.map((i) => (i.key === key ? { ...i, quantity: clamp(quantity, i.max_quantity) } : i));
}

export function setCartLineNote(prev: CartItem[], key: string, note: string): CartItem[] {
  return prev.map((i) => (i.key === key ? { ...i, note: note.trim() || null } : i));
}
