import type { EbayListing, EbayListingFormState, ListingProductDefaults } from "@/types/marketplace";
import { isGeneratedEbayDescription } from "@/components/listings/platforms/ebay/ebayDescriptionGenerator";

function normaliseSpn(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const arr = (raw as string[]).filter((s) => s !== "");
    return arr.length > 0 ? arr : [""];
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [""];
}

// Listing -> form for re-saves; overrides are never prefilled from the product.
export function listingToForm(listing: EbayListing): EbayListingFormState {
  const productId =
    typeof listing.product === "object" ? listing.product._id : listing.product;
  const variantId =
    listing.variant && typeof listing.variant === "object"
      ? listing.variant._id
      : (listing.variant as string | null) ?? "";

  const p = listing.product !== null && typeof listing.product === "object" ? listing.product : null;

  const rawFitment = (listing as unknown as Record<string, unknown>).fitment;
  const fitmentRows = Array.isArray(rawFitment) ? (rawFitment as Array<Record<string, unknown>>) : [];


  return {
    product_id: productId,
    variant_id: variantId,
    title_override: listing.title_override || "",
    // Blank a stored generated template so the server re-renders it.
    description_override: isGeneratedEbayDescription(listing.description_override) ? "" : listing.description_override || "",
    price_override: listing.price_override != null ? String(listing.price_override) : "",
    photo_overrides: (listing.photo_overrides as unknown as import("@/types/product").Attachment[]) || [],
    ebay_category_id: listing.ebay_category_id || "",
    store_category_id: listing.store_category_id || "",
    store_sku: listing.store_sku || p?.sku || "",
    condition: listing.condition || "",
    condition_notes: listing.condition_notes || "",
    item_specifics: {
      brand: listing.item_specifics?.brand || "",
      mpn: listing.item_specifics?.mpn || "",
      superseded_part_number: normaliseSpn(
        (listing.item_specifics as unknown as Record<string, unknown>)?.superseded_part_number
      ),
      aspects: ((listing.item_specifics as unknown as Record<string, unknown>)?.aspects as Record<string, string>) ?? {},
      authenticity: listing.item_specifics?.authenticity || "",
      warranty: listing.item_specifics?.warranty || "",
    },
    fitment: fitmentRows.map((r) => ({
      make: String(r.make ?? ""),
      model: String(r.model ?? ""),
      model_code: String(r.model_code ?? ""),
      year_from: r.year_from != null ? String(r.year_from) : "",
      year_to: r.year_to != null ? String(r.year_to) : "",
    })),
    format: listing.format || "FIXED_PRICE",
    quantity_available:
      listing.quantity_available != null ? String(listing.quantity_available) : "",
    listing_duration: listing.listing_duration || "GTC",
    accept_best_offer: listing.accept_best_offer || false,
    min_best_offer: listing.min_best_offer != null ? String(listing.min_best_offer) : "",
    fulfillment_policy_id: listing.fulfillment_policy_id || "",
    payment_policy_id: listing.payment_policy_id || "",
    return_policy_id: listing.return_policy_id || "",
    require_immediate_payment: listing.require_immediate_payment ?? true,
    item_location_zip: listing.item_location_zip || "",
    package: {
      length: listing.package?.length != null ? String(listing.package.length) : "",
      width: listing.package?.width != null ? String(listing.package.width) : "",
      height: listing.package?.height != null ? String(listing.package.height) : "",
      weight: listing.package?.weight != null ? String(listing.package.weight) : "",
    },
  };
}

// Values an empty override inherits (variant, then product) from the listing.
export function getListingProductDefaults(listing: EbayListing): ListingProductDefaults {
  const variant = listing.variant && typeof listing.variant === "object" ? listing.variant : null;
  const product = listing.product !== null && typeof listing.product === "object" ? listing.product : null;
  const variantPrice = (variant as { price?: number | null } | null)?.price;
  const variantPhotos = variant?.attachments ?? [];
  return {
    title: product?.title ?? "",
    price: variantPrice ?? product?.price ?? null,
    photos: variantPhotos.length > 0 ? variantPhotos : (product?.attachments ?? []),
  };
}

// Photos fall back to variant then product (as resolvePhotos); needs populate.
export function getListingFallbackImageUrl(listing: EbayListing): string | undefined {
  const variant = listing.variant && typeof listing.variant === "object" ? listing.variant : null;
  const product = listing.product !== null && typeof listing.product === "object" ? listing.product : null;
  const attachments =
    variant?.attachments && variant.attachments.length > 0 ? variant.attachments : product?.attachments;
  return attachments?.[0]?.url;
}
