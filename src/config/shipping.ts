import type { AuStateCode, ShippingAddressType, ShippingMethod } from "@/types/shipping";

export const SHIPPING_METHOD_OPTIONS: { value: ShippingMethod; label: string }[] = [
  { value: "standard", label: "Standard (flat rate)" },
  { value: "calculated", label: "Calculated (by customer postcode)" },
  { value: "pickup", label: "Local pickup only" },
];

export const SHIPPING_ADDRESS_TYPE_OPTIONS: { value: ShippingAddressType; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "residential", label: "Residential" },
];

// Transdirect accepts only these codes, never full state names.
export const AU_STATE_OPTIONS: { value: AuStateCode; label: string }[] = [
  { value: "ACT", label: "ACT" },
  { value: "NSW", label: "NSW" },
  { value: "NT", label: "NT" },
  { value: "QLD", label: "QLD" },
  { value: "SA", label: "SA" },
  { value: "TAS", label: "TAS" },
  { value: "VIC", label: "VIC" },
  { value: "WA", label: "WA" },
];
