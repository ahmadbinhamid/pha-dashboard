import type { ChannelFieldDescriptor, ChannelProductConstraints } from "@/types/channel";
import type { ListingProductDefaults } from "@/types/marketplace";

// UX mirror of the server's fieldSchema rules (the server re-checks everything).

export type ChannelFieldErrors = Record<string, string>;

export interface ChannelFieldContext {
  // Server-side fallbacks for blank fields.
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

  // Limits apply to the effective value.
  const maxTitle = constraints?.title?.maxLength;
  const override = typeof form.title_override === "string" ? form.title_override.trim() : "";
  const title = override || productDefaults.title;
  if (maxTitle && title.length > maxTitle) {
    errors.title_override = `${override ? "Title override" : "Product title"} is ${title.length} characters — this channel allows ${maxTitle}.`;
  }
  return errors;
}
