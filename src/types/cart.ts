export interface CartItem {
  // `${product_id}:${variant_id ?? "base"}` — unique dedup key per line.
  key: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  image_url: string | null;
  unit_price: number; // dollars, matches Product/ProductVariant.price convention
  quantity: number;
  // Soft stock cap captured at add-to-cart time — a best-effort UX guard
  // only; the backend always re-validates real stock at order-creation time.
  max_quantity: number | null;
  // Customer-facing note for this specific line (e.g. "no engine oil
  // included") — editable from the Add Products and Review Order steps.
  note: string | null;
}

export type AddCartItemInput = Omit<CartItem, "quantity" | "note"> & { quantity?: number; note?: string | null };
