// services/marketplace/packageFallback.test.js
// Product package reaches eBay unless the listing overrides it. No Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");

const { toPackage, hasPackage } = require("../../utils/packageDimensions");
const { resolvePackage } = require("./productFallbacks");
const { buildInventoryItemFromResolved } = require("../ebay/ebay.api.service");

const EMPTY = { length: null, width: null, height: null, weight: null };
const PRODUCT_PKG = { length: 30, width: 20, height: 10, weight: 1.5 };

test("toPackage: blanks, zero and junk are unset; JSON strings parse", () => {
  assert.deepEqual(toPackage({ length: "", width: "0", height: "abc", weight: null }), EMPTY);
  assert.deepEqual(toPackage('{"length":"30","weight":"1.5"}'), { ...EMPTY, length: 30, weight: 1.5 });
  assert.deepEqual(toPackage("not json"), EMPTY);
  assert.equal(hasPackage(EMPTY), false);
});

test("resolvePackage: empty listing uses the product's package", () => {
  assert.deepEqual(resolvePackage({ package: EMPTY }, { package: PRODUCT_PKG }), PRODUCT_PKG);
  assert.deepEqual(resolvePackage({}, { package: PRODUCT_PKG }), PRODUCT_PKG);
});

test("resolvePackage: any listing value overrides the whole package, never mixed", () => {
  const listing = { package: { ...EMPTY, weight: 4 } };
  assert.deepEqual(resolvePackage(listing, { package: PRODUCT_PKG }), { ...EMPTY, weight: 4 });
});

test("resolvePackage: neither set is null", () => {
  assert.equal(resolvePackage({ package: EMPTY }, { package: EMPTY }), null);
  assert.equal(resolvePackage({}, {}), null);
});

test("eBay inventory item carries the resolved (product) package", () => {
  const resolved = {
    sku: "PKG-1",
    title: "t",
    description: "d",
    brand: null,
    photos: [],
    listing: { item_specifics: {}, package: EMPTY },
    product: { package: PRODUCT_PKG },
    package: resolvePackage({ package: EMPTY }, { package: PRODUCT_PKG }),
    condition: "NEW",
    fitment: [],
  };
  const item = buildInventoryItemFromResolved(resolved, 1, "NEW", null);
  assert.deepEqual(item.packageWeightAndSize, {
    dimensions: { length: 30, width: 20, height: 10, unit: "CENTIMETER" },
    weight: { value: 1.5, unit: "KILOGRAM" },
  });
});

test("eBay inventory item omits the package when nothing is set", () => {
  const resolved = { sku: "PKG-2", title: "t", description: "d", photos: [], listing: { item_specifics: {} }, product: {}, package: null, condition: "NEW", fitment: [] };
  assert.equal(buildInventoryItemFromResolved(resolved, 1, "NEW", null).packageWeightAndSize, undefined);
});

test("eBay package: partial dimensions and zero weight are never sent", () => {
  const base = { sku: "PKG-3", title: "t", description: "d", photos: [], listing: { item_specifics: {} }, product: {}, condition: "NEW", fitment: [] };
  const build = (pkg) => buildInventoryItemFromResolved({ ...base, package: pkg }, 1, "NEW", null).packageWeightAndSize;
  assert.deepEqual(build({ length: 40, width: null, height: 10, weight: 2 }), { weight: { value: 2, unit: "KILOGRAM" } });
  assert.deepEqual(build({ length: 40, width: 30, height: 20, weight: 0 }), {
    dimensions: { length: 40, width: 30, height: 20, unit: "CENTIMETER" },
  });
  assert.equal(build({ length: 40, width: 0, height: 0, weight: 0 }), undefined);
});
