export type BrandSource = "listing" | "product" | "store_default";

export interface ResolvedBrand {
  brand: string | null;
  source: BrandSource | null;
}

const present = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

// NOTE: mirrors server productFallbacks#resolveBrand for display only.
export function resolveChannelBrand(input: {
  listingBrand?: string | null;
  productBrand?: string | null;
  defaultBrand?: string | null;
  usesDefault: boolean;
}): ResolvedBrand {
  const own = present(input.listingBrand);
  if (own) return { brand: own, source: "listing" };
  const product = present(input.productBrand);
  if (product) return { brand: product, source: "product" };
  const fallback = input.usesDefault ? present(input.defaultBrand) : null;
  return fallback ? { brand: fallback, source: "store_default" } : { brand: null, source: null };
}
