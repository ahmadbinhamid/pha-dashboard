import type { EbayListing, EbayListingFormState } from "@/types/marketplace";

function normaliseSpn(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const arr = (raw as string[]).filter((s) => s !== "");
    return arr.length > 0 ? arr : [""];
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [""];
}

// Shared by every place that needs to resave a listing before pushing it to
// eBay (ListingEditPage's own form, and ListingsPage's row-level "Push to
// eBay" action) — description_override is generated client-side from this
// form state, so any push path that skips regenerating it will resend
// whatever HTML happens to already be stored (see ebayDescriptionGenerator.ts).
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

  const pExt = p as unknown as Record<string, unknown>;

  return {
    product_id: productId,
    variant_id: variantId,
    title_override: listing.title_override || p?.title || "",
    description_override: listing.description_override || "",
    price_override: listing.price_override != null
      ? String(listing.price_override)
      : p?.price != null ? String(p.price) : "",
    photo_overrides: (listing.photo_overrides as unknown as import("@/types/product").Attachment[]) || [],
    ebay_category_id: listing.ebay_category_id || "",
    store_category_id: listing.store_category_id || "",
    store_sku: listing.store_sku || p?.sku || "",
    condition: listing.condition || "NEW",
    condition_notes: listing.condition_notes || "",
    item_specifics: {
      brand: listing.item_specifics?.brand || "",
      mpn: listing.item_specifics?.mpn || (typeof pExt?.mpn === "string" ? pExt.mpn : "") || "",
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

// Product/variant photo to send to the server as the description-image
// fallback when the listing has no photo_overrides of its own — same
// variant -> product precedence as the backend's own
// listing.resolver.js#resolvePhotos, kept in sync here so the description
// HTML embeds a real photo under the same conditions the eBay photo gallery
// already does. Requires the listing's `product`/`variant` to be populated
// with `attachments` (see ebay.listing.service.js#getListingById).
export function getListingFallbackImageUrl(listing: EbayListing): string | undefined {
  const variant = listing.variant && typeof listing.variant === "object" ? listing.variant : null;
  const product = listing.product !== null && typeof listing.product === "object" ? listing.product : null;
  const attachments =
    variant?.attachments && variant.attachments.length > 0 ? variant.attachments : product?.attachments;
  return attachments?.[0]?.url;
}
