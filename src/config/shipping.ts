import type { ShippingAddressType, ShippingMethod } from "@/types/shipping";

export const SHIPPING_METHOD_OPTIONS: { value: ShippingMethod; label: string }[] = [
  { value: "standard", label: "Standard (flat rate)" },
  { value: "calculated", label: "Calculated (by customer postcode)" },
];

export const SHIPPING_ADDRESS_TYPE_OPTIONS: { value: ShippingAddressType; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "residential", label: "Residential" },
];
