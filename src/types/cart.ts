export interface CartItem {
  // Dedup key: `${product_id}:${variant_id ?? "base"}`, or `custom:<uuid>`.
  key: string;
  // Null for custom lines: typed in at POS, never a catalogue product.
  product_id: string | null;
  variant_id: string | null;
  is_custom: boolean;
  name: string;
  sku: string | null;
  image_url: string | null;
  unit_price: number; // dollars, matches Product/ProductVariant.price convention
  // Per-unit freight in dollars, summed into the order total for delivery only.
  shipping_cost: number;
  quantity: number;
  // Soft stock cap at add time; the backend re-validates on order creation.
  max_quantity: number | null;
  // Customer-facing note, editable on the Add Products and Review Order steps.
  note: string | null;
  // Dollars; custom lines prefill the Review step's discount with this.
  default_discount: number | null;
}

export type AddCartItemInput = Omit<CartItem, "quantity" | "note" | "is_custom" | "default_discount"> & {
  quantity?: number;
  note?: string | null;
  is_custom?: boolean;
  default_discount?: number | null;
};
