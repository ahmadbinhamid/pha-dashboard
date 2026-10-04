// utils/marketplaceListing.js
// Public-safe listing subset for the storefront; eBay-shaped for now.
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

// Storefront display values: listing override, else product; deduped fitment.
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
  for (const f of product.additional_fitments ?? []) pushFitment(f);
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
