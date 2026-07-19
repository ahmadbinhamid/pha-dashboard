// utils/marketplaceListing.js
//
// Shapes a MarketplaceListing document into the curated, public-safe subset
// exposed on the storefront's product detail response. Internal/operational
// fields (sync_status, fulfillment/payment/return policy ids, external ids,
// package dimensions, etc.) are deliberately excluded — those are inputs to
// the platform adapter, not storefront content.
//
// Only the eBay discriminator is implemented today, so this mapper is
// eBay-shaped; branch on `listing.platform` here once Amazon/Shopify land.
function toPublicListing(listing) {
  const aspects =
    listing.item_specifics?.aspects instanceof Map
      ? Object.fromEntries(listing.item_specifics.aspects)
      : listing.item_specifics?.aspects ?? {};

  return {
    platform: listing.platform,
    title_override: listing.title_override,
    description_override: listing.description_override,
    price_override: listing.price_override,
    photos: (listing.photo_overrides || []).map((a) => a.url).filter(Boolean),
    condition: listing.condition ?? null,
    condition_notes: listing.condition_notes || null,
    warranty: listing.item_specifics?.warranty ?? null,
    superseded_part_number: listing.item_specifics?.superseded_part_number ?? [],
    authenticity: listing.item_specifics?.authenticity ?? null,
    aspects,
    fitment: listing.fitment ?? [],
  };
}

function fitmentKey(f) {
  return `${f.make || ""}|${f.model || ""}|${f.model_code || ""}|${f.year_from ?? ""}|${f.year_to ?? ""}`;
}

// Resolves the "which value wins" business logic for a product's storefront
// display: a listing's override wins when present, else the product's own
// value — and merges/dedupes vehicle fitment across the product and its
// listing(s). This is domain/precedence logic, not presentation (no English
// labels or formatted strings here — that stays in the frontend).
//
// `primaryListing` is the first active listing for the product (there's
// realistically 0-1 non-variant listing today; revisit this "first wins"
// assumption if/when a product can carry multiple concurrently-relevant
// listings, e.g. one per marketplace, that should all inform display).
function buildProductDisplay(product, listings) {
  const primaryListing = listings[0] ?? null;

  const fitments = [];
  const seen = new Set();
  const pushFitment = (f) => {
    if (!f.make && !f.model) return;
    const key = fitmentKey(f);
    if (seen.has(key)) return;
    seen.add(key);
    fitments.push({
      make: f.make ?? null,
      model: f.model ?? null,
      model_code: f.model_code ?? null,
      year_from: f.year_from ?? null,
      year_to: f.year_to ?? null,
    });
  };

  if (product.vehicle) pushFitment(product.vehicle);
  for (const listing of listings) {
    for (const f of listing.fitment ?? []) pushFitment(f);
  }

  return {
    condition: primaryListing?.condition ?? product.condition ?? null,
    authenticity: primaryListing?.authenticity ?? product.authenticity ?? null,
    warranty: primaryListing?.item_specifics?.warranty ?? null,
    condition_notes: primaryListing?.condition_notes || null,
    vehicle_fitments: fitments,
  };
}

module.exports = { toPublicListing, buildProductDisplay };
