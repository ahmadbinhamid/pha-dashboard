export interface CartItem {
  // `${product_id}:${variant_id ?? "base"}` — unique dedup key per line.
  key: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  image_url: string | null;
  unit_price: number; // dollars, matches Product/ProductVariant.price convention
  // Per-unit freight cost, dollars — always the parent Product's shipping_cost, summed into the order total for delivery only. Mirrors Order.service.js#resolveOrderItem.
  shipping_cost: number;
  quantity: number;
  // Soft stock cap at add-to-cart time — a best-effort UX guard; backend always re-validates at order-creation time.
  max_quantity: number | null;
  // Customer-facing note for this line, editable from Add Products and Review Order steps.
  note: string | null;
}

export type AddCartItemInput = Omit<CartItem, "quantity" | "note"> & { quantity?: number; note?: string | null };
