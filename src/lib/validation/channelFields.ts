import type { ChannelFieldDescriptor, ChannelProductConstraints } from "@/types/channel";
import type { ListingProductDefaults } from "@/types/marketplace";

// UX mirror of server/src/services/marketplace/fieldSchema.js — the server re-checks
// everything, this just catches it before a round trip.

export type ChannelFieldErrors = Record<string, string>;

export interface ChannelFieldContext {
  // Values a blank field falls back to server-side (mapped category, tenant default policy).
  fallbacks: Record<string, string | null | undefined>;
  constraints?: ChannelProductConstraints;
  productDefaults: ListingProductDefaults;
}

function isEmpty(value: unknown) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

export function validateChannelFields(
  schema: ChannelFieldDescriptor[],
  form: Record<string, unknown>,
  { fallbacks, constraints, productDefaults }: ChannelFieldContext,
): ChannelFieldErrors {
  const errors: ChannelFieldErrors = {};

  for (const d of schema) {
    const value = isEmpty(form[d.key]) ? fallbacks[d.key] : form[d.key];
    if (isEmpty(value)) {
      if (d.required) errors[d.key] = `${d.label} is required.`;
      continue;
    }
    if (d.type === "number" && !Number.isFinite(Number(value))) errors[d.key] = `${d.label} must be a number.`;
  }

  // Product-derived limits apply to the EFFECTIVE value (override, else product).
  const maxTitle = constraints?.title?.maxLength;
  const override = typeof form.title_override === "string" ? form.title_override.trim() : "";
  const title = override || productDefaults.title;
  if (maxTitle && title.length > maxTitle) {
    errors.title_override = `${override ? "Title override" : "Product title"} is ${title.length} characters — this channel allows ${maxTitle}.`;
  }
  return errors;
}
