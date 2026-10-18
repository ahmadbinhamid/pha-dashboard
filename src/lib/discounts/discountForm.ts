import { ORDER_RULE_RANGES } from "@/config/discounts";
import type { Discount, DiscountPayload, OrderRule } from "@/types/discount";
import type { DiscountFormValues } from "@/lib/validation/discount";

export const EMPTY_DISCOUNT_FORM: DiscountFormValues = {
  name: "",
  method: "code",
  code: "",
  discount_type: "percent",
  discount_value: 10,
  minimum_order: 0,
  scope: "storewide",
  category_ids: [],
  starts_at: null,
  ends_at: null,
  limit_usage: false,
  usage_limit: null,
  once_per_customer: false,
  order_rule: "any",
  order_min: null,
  order_max: null,
  active: true,
};

/** The preset rule a range matches, else "custom". */
function orderRuleFor(min: number | null, max: number | null): OrderRule {
  const match = Object.entries(ORDER_RULE_RANGES).find(([, r]) => r.min === min && r.max === max);
  return (match?.[0] as OrderRule | undefined) ?? "custom";
}

/** Order-number range for the form's rule. */
export function orderRangeFromForm(v: Pick<DiscountFormValues, "order_rule" | "order_min" | "order_max">) {
  return v.order_rule === "custom" ? { min: v.order_min, max: v.order_max } : ORDER_RULE_RANGES[v.order_rule];
}

export function discountToFormValues(discount: Discount | null): DiscountFormValues {
  if (!discount) return EMPTY_DISCOUNT_FORM;
  return {
    name: discount.name,
    method: discount.is_automatic ? "automatic" : "code",
    code: discount.code ?? "",
    discount_type: discount.discount_type,
    discount_value: discount.discount_value,
    minimum_order: discount.minimum_order,
    scope: discount.scope,
    category_ids: discount.category_ids,
    starts_at: discount.starts_at,
    ends_at: discount.ends_at,
    limit_usage: discount.usage_limit != null,
    usage_limit: discount.usage_limit,
    once_per_customer: discount.once_per_customer,
    order_rule: orderRuleFor(discount.min_order_number, discount.max_order_number),
    order_min: discount.min_order_number,
    order_max: discount.max_order_number,
    active: discount.active,
  };
}

export function formValuesToPayload(v: DiscountFormValues): DiscountPayload {
  const automatic = v.method === "automatic";
  const range = orderRangeFromForm(v);
  return {
    name: v.name,
    is_automatic: automatic,
    code: automatic ? null : v.code.toUpperCase(),
    discount_type: v.discount_type,
    discount_value: v.discount_type === "free_shipping" ? 0 : v.discount_value,
    minimum_order: v.minimum_order || 0,
    scope: v.scope,
    category_ids: v.scope === "categories" ? v.category_ids : [],
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    usage_limit: v.limit_usage ? v.usage_limit : null,
    once_per_customer: v.once_per_customer,
    min_order_number: range.min,
    max_order_number: range.max,
    active: v.active,
  };
}

/** Form values for a "New discount" template. */
export function templateFormValues(values: Partial<DiscountFormValues>): DiscountFormValues {
  return { ...EMPTY_DISCOUNT_FORM, ...values };
}

/** A paused copy for a new discount, the code is cleared (codes are unique). */
export function duplicateFormValues(discount: Discount): DiscountFormValues {
  return { ...discountToFormValues(discount), name: `${discount.name} (copy)`, code: "", active: false };
}

/** Random upper-case code, skipping look-alike characters (0/O, 1/I). */
export function generatePromoCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
