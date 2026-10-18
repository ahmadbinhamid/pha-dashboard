import { z } from "zod";
import { MAX_ORDER_NUMBER, MAX_PERCENT_OFF, PROMO_CODE_PATTERN } from "@/config/discounts";

export const discountFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the discount a name").max(80),
    method: z.enum(["code", "automatic"]),
    code: z.string().trim(),
    discount_type: z.enum(["percent", "fixed", "free_shipping"]),
    discount_value: z.number(),
    minimum_order: z.number().min(0, "Can't be negative"),
    scope: z.enum(["storewide", "categories"]),
    category_ids: z.array(z.string()),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    limit_usage: z.boolean(),
    usage_limit: z.number().int().nullable(),
    once_per_customer: z.boolean(),
    order_rule: z.enum(["any", "first", "second", "repeat", "custom"]),
    order_min: z.number().int().min(1).max(MAX_ORDER_NUMBER).nullable(),
    order_max: z.number().int().min(1).max(MAX_ORDER_NUMBER).nullable(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.method === "code" && !PROMO_CODE_PATTERN.test(v.code)) issue("code", "3-24 letters, numbers, . - or _");
    if (v.discount_type === "percent" && (v.discount_value < 1 || v.discount_value > MAX_PERCENT_OFF)) {
      issue("discount_value", `Between 1% and ${MAX_PERCENT_OFF}%`);
    }
    if (v.discount_type === "fixed" && !(v.discount_value > 0)) issue("discount_value", "Enter a dollar amount");
    if (v.scope === "categories" && !v.category_ids.length) issue("category_ids", "Pick at least one category");
    if (v.starts_at && v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) issue("ends_at", "Must be after the start");
    if (v.limit_usage && !(v.usage_limit && v.usage_limit >= 1)) issue("usage_limit", "Enter how many uses");
    if (v.order_rule === "custom") {
      if (!v.order_min && !v.order_max) issue("order_min", "Set a first and/or last order");
      if (v.order_min && v.order_max && v.order_max < v.order_min) issue("order_max", "Can't be before the first");
    }
  });

export type DiscountFormValues = z.infer<typeof discountFormSchema>;

