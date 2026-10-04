// services/marketplace/productFallbacks.js
// Listing-override-else-product rules shared by resolver, schemas and backfill.

const { toPackage, hasPackage } = require("../../utils/packageDimensions");

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

// Rows naming a make or model; blank form rows don't count.
function namedFitmentRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => present(r?.make) || present(r?.model));
}

function listingFitmentRows(listing) {
  return namedFitmentRows(listing?.fitment);
}

/** Fitment table: listing rows, else the product's non-default vehicles. */
function resolveFitment(listing, product) {
  const rows = listingFitmentRows(listing);
  return (rows.length ? rows : namedFitmentRows(product?.additional_fitments)).map(toFitmentRow);
}

// Listing package if any value is set, else the product's; never mixed.
function resolvePackage(listing, product) {
  if (hasPackage(listing?.package)) return toPackage(listing.package);
  return hasPackage(product?.package) ? toPackage(product.package) : null;
}

module.exports = {
  present,
  resolvePackage,
  resolveCondition,
  resolveAuthenticity,
  resolveFitment,
  fitmentFromVehicle,
  namedFitmentRows,
  listingFitmentRows,
  toFitmentRow,
  FITMENT_KEYS,
};
