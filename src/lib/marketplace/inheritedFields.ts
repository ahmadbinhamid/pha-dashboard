import { AUTHENTICITY_OPTIONS, CONDITIONS } from "@/config/productOptions";
import type { Product, ProductVehicle } from "@/types/product";

// Listing fields that inherit a product field (fieldSchema `inheritsFrom`).
function labelOf(options: { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function formatVehicle(vehicle: ProductVehicle | null | undefined): string | null {
  if (!vehicle || (!vehicle.make && !vehicle.model)) return null;
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const code = vehicle.model_code ? ` (${vehicle.model_code})` : "";
  const years =
    vehicle.year_from != null
      ? ` ${vehicle.year_from}${vehicle.year_to != null && vehicle.year_to !== vehicle.year_from ? `–${vehicle.year_to}` : ""}`
      : "";
  return `${name}${code}${years}`;
}

/** The product's value as shown in the channel panel, or null when unset. */
export function productValueLabel(field: string, product: Product): string | null {
  if (field === "condition") return product.condition ? labelOf(CONDITIONS, product.condition) : null;
  if (field === "authenticity") return product.authenticity ? labelOf(AUTHENTICITY_OPTIONS, product.authenticity) : null;
  if (field === "vehicle") return formatVehicle(product.vehicle);
  const value = (product as unknown as Record<string, unknown>)[field];
  return value == null || value === "" ? null : String(value);
}

/** True when the listing holds its own value (an override). */
export function hasOverride(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((row: Record<string, unknown> | null) => !!(String(row?.make ?? "").trim() || String(row?.model ?? "").trim()));
  }
  return value != null && String(value).trim() !== "";
}

/** The listing value meaning "use the product's". */
export function clearedValue(value: unknown): "" | [] {
  return Array.isArray(value) ? [] : "";
}
