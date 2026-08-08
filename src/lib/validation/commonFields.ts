import { z } from "zod";

// Shared Zod schemas for field-level validation used across the app's forms
// (product pricing, listing pricing, vehicle fitment years, etc.) — even in
// forms not yet fully migrated to react-hook-form, these are used via
// `.safeParse()` inside the existing manual validate() functions, so every
// form ends up enforcing the exact same rules instead of each hand-rolling
// its own (inconsistent, easy-to-miss-a-case) checks.

// Form state stores every numeric field as a string (controlled <input>
// value), so this coerces before checking — this is also what catches the
// "-" bug: Number("-") is NaN, and a naive `Number(x) <= 0` check treats
// NaN <= 0 as false (NaN comparisons are always false), silently letting
// non-numeric junk through. z.coerce.number() rejects it outright instead.
export function priceSchema(label = "Price") {
  return z.coerce
    .number({ error: `${label} must be a number` })
    .refine((n) => Number.isFinite(n), `${label} must be a number`)
    .refine((n) => n > 0, `${label} must be greater than 0`);
}

// For optional cost/shipping-style price fields — blank is allowed, but
// anything entered must still be a valid non-negative number.
export function optionalNonNegativePriceSchema(label = "Price") {
  return z
    .string()
    .trim()
    .refine((s) => s === "" || (Number.isFinite(Number(s)) && Number(s) >= 0), `${label} must be a number 0 or greater`);
}

// year_from/year_to are both stored as strings ("" meaning "not set" — for
// year_to specifically, "" also means "present/ongoing", not an error).
// Validates: year_from must be a real 4-digit year if present, year_to must
// be a real 4-digit year if present, and when both are present, year_to
// cannot be before year_from — a vehicle can't stop being made before it
// started.
export const vehicleYearRangeSchema = z
  .object({
    year_from: z.string(),
    year_to: z.string(),
  })
  .refine((v) => v.year_to === "" || v.year_from !== "", {
    message: "Select a start year before choosing an end year",
    path: ["year_to"],
  })
  .refine((v) => v.year_to === "" || v.year_from === "" || Number(v.year_to) >= Number(v.year_from), {
    message: "End year can't be before the start year",
    path: ["year_to"],
  });

export function validateVehicleYearRange(year_from: string, year_to: string): string | null {
  const result = vehicleYearRangeSchema.safeParse({ year_from, year_to });
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Invalid year range";
}
