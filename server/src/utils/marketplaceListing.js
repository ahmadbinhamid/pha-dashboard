// utils/marketplaceListing.js
// Shapes a MarketplaceListing into the curated, public-safe subset for the storefront's
// product detail response; internal/operational fields are deliberately excluded.
// Only eBay is implemented today, so this mapper is eBay-shaped; branch on `listing.platform`
// once Amazon/Shopify land.
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
    mpn: listing.item_specifics?.mpn ?? null,
    superseded_part_number: listing.item_specifics?.superseded_part_number ?? [],
    authenticity: listing.item_specifics?.authenticity ?? null,
    aspects,
    fitment: listing.fitment ?? [],
  };
}

function fitmentKey(f) {
  return `${f.make || ""}|${f.model || ""}|${f.model_code || ""}|${f.year_from ?? ""}|${f.year_to ?? ""}`;
}

// Resolves "which value wins" for storefront display: a listing's override wins when present,
// else the product's own value, plus merged/deduped vehicle fitment. Domain/precedence logic
// only, no presentation. `primaryListing` is the first active listing (0-1 today; revisit if a
// product can carry multiple concurrently-relevant listings).
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
    mpn: primaryListing?.item_specifics?.mpn ?? product.mpn ?? null,
    vehicle_fitments: fitments,
  };
}

module.exports = { toPublicListing, buildProductDisplay };
