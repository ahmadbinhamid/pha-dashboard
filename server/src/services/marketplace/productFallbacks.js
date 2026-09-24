// services/marketplace/productFallbacks.js
// Listing-override-else-product rules shared by resolver, schemas and backfill.

// NOTE: "" counts as unset; older forms saved empty strings for "not chosen".
function present(value) {
  return value == null || value === "" ? null : value;
}

/** Listing override, else the product's condition (vocab mapped later). */
function resolveCondition(listing, product) {
  return present(listing?.condition) ?? present(product?.condition);
}

function resolveAuthenticity(listing, product) {
  return present(listing?.item_specifics?.authenticity) ?? present(product?.authenticity);
}

const FITMENT_KEYS = Object.freeze(["make", "model", "model_code", "year_from", "year_to"]);

function toFitmentRow(source) {
  return Object.fromEntries(FITMENT_KEYS.map((k) => [k, present(source?.[k])]));
}

// One fitment row from Product.vehicle; [] when it names no make or model.
function fitmentFromVehicle(vehicle) {
  if (!vehicle || (!present(vehicle.make) && !present(vehicle.model))) return [];
  return [toFitmentRow(vehicle)];
}

// Stored rows naming a make or model; blank form rows don't count.
function listingFitmentRows(listing) {
  return (Array.isArray(listing?.fitment) ? listing.fitment : []).filter((r) => present(r?.make) || present(r?.model));
}

/** Listing rows if any, else one row derived from product.vehicle. */
function resolveFitment(listing, product) {
  const rows = listingFitmentRows(listing);
  return rows.length ? rows.map(toFitmentRow) : fitmentFromVehicle(product?.vehicle);
}

module.exports = {
  present,
  resolveCondition,
  resolveAuthenticity,
  resolveFitment,
  fitmentFromVehicle,
  listingFitmentRows,
  toFitmentRow,
  FITMENT_KEYS,
};
