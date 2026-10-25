import type { ProductAuthenticity, ProductCondition } from "@/types/product";

export const CONDITION_LABEL: Record<ProductCondition, string> = { NEW: "New", USED: "Used" };
export const AUTHENTICITY_LABEL: Record<ProductAuthenticity, string> = {
  Genuine: "Genuine",
  Aftermarket: "Aftermarket",
};

// The label maps are the one value list; Record forces a label per value.
export const CONDITION_VALUES = Object.keys(CONDITION_LABEL) as [ProductCondition, ...ProductCondition[]];
export const AUTHENTICITY_VALUES = Object.keys(AUTHENTICITY_LABEL) as [ProductAuthenticity, ...ProductAuthenticity[]];

export const CONDITIONS = CONDITION_VALUES.map((value) => ({ value, label: CONDITION_LABEL[value] }));
export const AUTHENTICITY_OPTIONS = AUTHENTICITY_VALUES.map((value) => ({ value, label: AUTHENTICITY_LABEL[value] }));

// Custom order lines may leave either chip off; "" is SingleSelect's empty.
export const OPTIONAL_CONDITION_OPTIONS = [{ value: "", label: "Not set" }, ...CONDITIONS];
export const OPTIONAL_AUTHENTICITY_OPTIONS = [{ value: "", label: "Not set" }, ...AUTHENTICITY_OPTIONS];

export const WARRANTY_OPTIONS = [
  { value: "1 Month", label: "1 Month" },
  { value: "3 Months", label: "3 Months" },
  { value: "6 Months", label: "6 Months" },
  { value: "12 Months", label: "12 Months" },
];

// Same cap the server's create validator puts on brand.
export const PRODUCT_BRAND_MAX_LENGTH = 100;
