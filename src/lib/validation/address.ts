import { z } from "zod";

// Base shape shared by every address (shipping/billing) — AddressFields.tsx renders these four fields everywhere, so every form composes this one schema.
export const addressFieldsSchema = z.object({
  address: z.string(),
  suburb: z.string(),
  state: z.string(),
  postcode: z.string(),
});

export type AddressFieldsValues = z.infer<typeof addressFieldsSchema>;

export const EMPTY_ADDRESS: AddressFieldsValues = { address: "", suburb: "", state: "", postcode: "" };

export function isAddressFilled(a: AddressFieldsValues): boolean {
  return !!(a.address.trim() || a.suburb.trim() || a.state.trim() || a.postcode.trim());
}

// All four fields required, used when an address section is mandatory (e.g. storefront checkout shipping).
export const requiredAddressSchema = z.object({
  address: z.string().trim().min(1, "Address is required"),
  suburb: z.string().trim().min(1, "Suburb is required"),
  state: z.string().trim().min(1, "State is required"),
  postcode: z.string().trim().min(1, "Postcode is required"),
});

// Optional as a whole, but "all or nothing": filling any field makes the rest required, so a half-typed address can't save as empty. Attach with `.superRefine` for a path-specific error (see customer.ts).
export function validatePartialAddress(a: AddressFieldsValues): Partial<Record<keyof AddressFieldsValues, string>> {
  if (!isAddressFilled(a)) return {};
  const errors: Partial<Record<keyof AddressFieldsValues, string>> = {};
  if (!a.address.trim()) errors.address = "Address is required";
  if (!a.suburb.trim()) errors.suburb = "Suburb is required";
  if (!a.state.trim()) errors.state = "State is required";
  if (!a.postcode.trim()) errors.postcode = "Postcode is required";
  return errors;
}
