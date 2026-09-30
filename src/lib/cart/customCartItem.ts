import type { AddCartItemInput } from "@/types/cart";
import type { CustomOrderItemFormValues } from "@/lib/validation/customOrderItem";

// Key minted once per add and stored on the item; rows act on item.key.
export function buildCustomCartItem(
  values: CustomOrderItemFormValues,
  id: string = crypto.randomUUID(),
): AddCartItemInput {
  return {
    key: `custom:${id}`,
    product_id: null,
    variant_id: null,
    is_custom: true,
    name: values.title,
    sku: null,
    image_url: null,
    unit_price: Number(values.price),
    shipping_cost: values.shipping ? Number(values.shipping) : 0,
    max_quantity: null,
    default_discount: values.discount ? Number(values.discount) : null,
  };
}
