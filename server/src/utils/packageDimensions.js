// utils/packageDimensions.js
// Package size (cm) and weight (kg), shared by products and eBay listings.

const PACKAGE_KEYS = Object.freeze(["length", "width", "height", "weight"]);

// Blank, non-numeric or <= 0 means unset, so an empty field never sends 0.
function toDimension(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Normalised { length, width, height, weight }; accepts JSON from FormData. */
function toPackage(value) {
  const source = typeof value === "string" ? parseJson(value) : value;
  return Object.fromEntries(PACKAGE_KEYS.map((k) => [k, toDimension(source?.[k])]));
}

function hasPackage(value) {
  return PACKAGE_KEYS.some((k) => toDimension(value?.[k]) != null);
}

// Calculated shipping needs every dimension and the weight.
function isCompletePackage(value) {
  return PACKAGE_KEYS.every((k) => toDimension(value?.[k]) != null);
}

module.exports = { PACKAGE_KEYS, toPackage, hasPackage, isCompletePackage };
