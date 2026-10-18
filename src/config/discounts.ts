import { Gift, HeartHandshake, PartyPopper, Sparkles, Ticket, Truck } from "lucide-react";
import type { SegmentedOption } from "@/components/ui/SegmentedControl";
import type { DiscountScope, DiscountStatus, DiscountType, OrderRule } from "@/types/discount";
import type { DiscountFormValues } from "@/lib/validation/discount";

export const MAX_PERCENT_OFF = 90;

// Discounts live under Storefront, editor pages hang off this path.
export const DISCOUNTS_BASE_PATH = "/storefront/discounts";

// Mirrors the server's PROMO_CODE_PATTERN, codes are stored upper-case.
export const PROMO_CODE_PATTERN = /^[A-Z0-9._-]{3,24}$/i;

export const GENERATED_CODE_LENGTH = 8;

export const DISCOUNT_TYPE_OPTIONS: SegmentedOption<DiscountType>[] = [
  { value: "percent", label: "% Off" },
  { value: "fixed", label: "$ Off order" },
  { value: "free_shipping", label: "Free shipping" },
];

export const DISCOUNT_SCOPE_OPTIONS: SegmentedOption<DiscountScope>[] = [
  { value: "storewide", label: "Whole store" },
  { value: "categories", label: "Selected categories" },
];

// The two ways a discount reaches a shopper, explained in plain words.
export const DISCOUNT_METHODS = [
  {
    value: "code",
    label: "Promo code",
    icon: Ticket,
    description: "Shoppers must type the code at checkout. Nobody gets it without the code.",
    example: "e.g. share SAVE10 in an email or on social",
  },
  {
    value: "automatic",
    label: "Automatic deal",
    icon: Sparkles,
    description: "Applies on its own when the cart qualifies. No code needed.",
    example: "e.g. 10% off all brakes this weekend",
  },
] as const;

export const MAX_ORDER_NUMBER = 100;

export const ORDER_RULE_OPTIONS: SegmentedOption<OrderRule>[] = [
  { value: "any", label: "Any order" },
  { value: "first", label: "First order" },
  { value: "second", label: "2nd order" },
  { value: "repeat", label: "Repeat orders" },
  { value: "custom", label: "Custom" },
];

// Fixed rules as order-number ranges, "custom" uses the form's own numbers.
export const ORDER_RULE_RANGES: Record<Exclude<OrderRule, "custom">, { min: number | null; max: number | null }> = {
  any: { min: null, max: null },
  first: { min: 1, max: 1 },
  second: { min: 2, max: 2 },
  repeat: { min: 2, max: null },
};

export const DISCOUNT_STATUS_CONFIG: Record<DiscountStatus, { label: string; variant: "ok" | "warn" | "muted" | "default" }> = {
  live: { label: "Live", variant: "ok" },
  scheduled: { label: "Scheduled", variant: "default" },
  paused: { label: "Paused", variant: "muted" },
  ended: { label: "Ended", variant: "muted" },
  exhausted: { label: "Used up", variant: "warn" },
};

// List filter: "inactive" groups paused, ended and used-up discounts.
export const DISCOUNT_LIST_FILTERS: SegmentedOption<"all" | "live" | "scheduled" | "inactive">[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "inactive", label: "Inactive" },
];

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

// "New discount" starting points, each pre-fills the form, all editable.
export const DISCOUNT_TEMPLATES = [
  {
    id: "code",
    label: "Promo code",
    description: "A code you share. Shoppers type it at checkout.",
    icon: Ticket,
    values: { method: "code" },
  },
  {
    id: "automatic",
    label: "Automatic deal",
    description: "Applies by itself when the cart qualifies.",
    icon: Sparkles,
    values: { method: "automatic", name: "Store-wide deal" },
  },
  {
    id: "returning",
    label: "Returning customer reward",
    description: "Thank customers on their 2nd order, automatically.",
    icon: HeartHandshake,
    values: { method: "automatic", name: "Returning customer reward", order_rule: "second" },
  },
  {
    id: "welcome",
    label: "Welcome offer",
    description: "A code for a customer's first order.",
    icon: PartyPopper,
    values: { method: "code", name: "Welcome offer", code: "WELCOME10", order_rule: "first" },
  },
  {
    id: "free-shipping",
    label: "Free shipping over $X",
    description: "Waives shipping on bigger carts.",
    icon: Truck,
    values: { method: "automatic", name: "Free shipping over $150", discount_type: "free_shipping", minimum_order: 150 },
  },
  {
    id: "category",
    label: "Category sale",
    description: "% off one or more categories.",
    icon: Gift,
    values: { method: "automatic", name: "Category sale", scope: "categories", discount_value: 15 },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  icon: unknown;
  values: Partial<DiscountFormValues>;
}[];
