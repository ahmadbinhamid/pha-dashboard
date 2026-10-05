import type { AddCartItemInput } from "@/types/cart";
import type { OrderLineInput } from "@/types/orders";

/** Maps a POS picker's cart line to the order line the API expects. */
export function orderLineFromCartItem(item: AddCartItemInput): OrderLineInput {
  if (item.is_custom) {
    return {
      is_custom: true,
      name: item.name,
      unit_price: item.unit_price,
      shipping_cost: item.shipping_cost,
      quantity: item.quantity ?? 1,
      discount_amount: item.default_discount ?? 0,
    };
  }
  return { product: item.product_id as string, variant: item.variant_id, quantity: item.quantity ?? 1 };
}
