import { z } from "zod";
import { optionalNonNegativePriceSchema } from "@/lib/validation/commonFields";
import { CUSTOM_ORDER_ITEM_TITLE_MAX } from "@/config/orderItems";
import { AUTHENTICITY_VALUES, CONDITION_VALUES } from "@/config/productOptions";

// Optional chips; "" (not set) is sent as null.
export const optionalConditionSchema = z.union([z.literal(""), z.enum(CONDITION_VALUES)]);
export const optionalAuthenticitySchema = z.union([z.literal(""), z.enum(AUTHENTICITY_VALUES)]);
export const customItemTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(CUSTOM_ORDER_ITEM_TITLE_MAX, "Title is too long");

// Inputs stay strings (controlled fields); numbers are parsed on submit.
export const customOrderItemSchema = z
  .object({
    title: customItemTitleSchema,
    price: z
      .string()
      .trim()
      .min(1, "Price is required")
      .refine((s) => Number.isFinite(Number(s)) && Number(s) > 0, "Price must be greater than 0"),
    shipping: optionalNonNegativePriceSchema("Shipping"),
    discount: optionalNonNegativePriceSchema("Discount"),
    condition: optionalConditionSchema,
    authenticity: optionalAuthenticitySchema,
  })
  .refine((v) => v.discount === "" || Number(v.discount) <= Number(v.price), {
    message: "Discount can't exceed the price",
    path: ["discount"],
  });

export type CustomOrderItemFormValues = z.infer<typeof customOrderItemSchema>;
