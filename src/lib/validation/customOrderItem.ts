import { z } from "zod";
import { optionalNonNegativePriceSchema } from "@/lib/validation/commonFields";
import { CUSTOM_ORDER_ITEM_TITLE_MAX } from "@/config/orderItems";

// Inputs stay strings (controlled fields); numbers are parsed on submit.
export const customOrderItemSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(CUSTOM_ORDER_ITEM_TITLE_MAX, "Title is too long"),
    price: z
      .string()
      .trim()
      .min(1, "Price is required")
      .refine((s) => Number.isFinite(Number(s)) && Number(s) > 0, "Price must be greater than 0"),
    shipping: optionalNonNegativePriceSchema("Shipping"),
    discount: optionalNonNegativePriceSchema("Discount"),
  })
  .refine((v) => v.discount === "" || Number(v.discount) <= Number(v.price), {
    message: "Discount can't exceed the price",
    path: ["discount"],
  });

export type CustomOrderItemFormValues = z.infer<typeof customOrderItemSchema>;
