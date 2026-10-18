export type DiscountType = "percent" | "fixed" | "free_shipping";
export type DiscountScope = "storewide" | "categories";
export type DiscountStatus = "live" | "scheduled" | "paused" | "ended" | "exhausted";
// Form shortcut for min/max_order_number, "custom" edits them directly.
export type OrderRule = "any" | "first" | "second" | "repeat" | "custom";
// List filter: "inactive" groups paused, ended and used-up discounts.
export type DiscountListFilter = "all" | "live" | "scheduled" | "inactive";

export interface Discount {
  _id: string;
  name: string;
  // Null for automatic discounts.
  code: string | null;
  is_automatic: boolean;
  discount_type: DiscountType;
  // Percent or dollars by discount_type, 0 for free shipping.
  discount_value: number;
  // Dollars, 0 means no minimum.
  minimum_order: number;
  scope: DiscountScope;
  category_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  // Null is unlimited.
  usage_limit: number | null;
  usage_count: number;
  once_per_customer: boolean;
  // Which of the shopper's paid website orders qualify (1 = first), null is open.
  min_order_number: number | null;
  max_order_number: number | null;
  active: boolean;
  status: DiscountStatus;
  created_at: string;
  updated_at: string;
}

export interface DiscountRedemption {
  _id: string;
  customer_email: string;
  discount_amount: number; // cents
  order_total: number; // cents
  created_at: string;
  // Null if the order was deleted.
  order: {
    _id: string;
    order_number: string;
    order_number_prefix: string;
    status: string;
    total: number;
  } | null;
}

export interface DiscountUsage {
  orders_count: number;
  discount_total: number; // cents
  order_total: number; // cents
  recent: DiscountRedemption[];
}

export interface DiscountDetail extends Discount {
  usage: DiscountUsage;
}

// Targeting already expanded to sub-categories, as the storefront needs it.
export interface FeaturedDiscount extends Discount {
  eligible_category_ids: string[];
}

export type DiscountPayload = Partial<
  Pick<
    Discount,
    | "name"
    | "code"
    | "is_automatic"
    | "discount_type"
    | "discount_value"
    | "minimum_order"
    | "scope"
    | "category_ids"
    | "starts_at"
    | "ends_at"
    | "usage_limit"
    | "once_per_customer"
    | "min_order_number"
    | "max_order_number"
    | "active"
  >
>;
