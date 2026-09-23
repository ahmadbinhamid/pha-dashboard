// services/marketplace/listing.resolver.overrides.test.js
// resolveListing's override semantics: null/empty overrides fall through to the product
// (or variant) value; a set override wins. Pure — no Mongo needed.

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveListing } = require("./listing.resolver");

const product = {
  _id: "p1",
  sku: "SKU-1",
  title: "Front Brake Disc",
  description: "Vented, pair",
  price: 120,
  attachments: [{ _id: "a1", url: "https://cdn/a1.jpg" }],
};

const noOverrides = { title_override: null, description_override: null, price_override: null, photo_overrides: [] };

test("resolveListing: null overrides fall through to the product value", () => {
  const resolved = resolveListing(noOverrides, product, null);
  assert.equal(resolved.title, product.title);
  assert.equal(resolved.description, product.description);
  assert.equal(resolved.price, product.price);
  assert.deepEqual(resolved.photos, product.attachments);
});

test("resolveListing: an empty-string override also falls through (never pushes a blank)", () => {
  const resolved = resolveListing({ ...noOverrides, title_override: "", description_override: "" }, product, null);
  assert.equal(resolved.title, product.title);
  assert.equal(resolved.description, product.description);
});

test("resolveListing: variant price/photos are the fallback when the listing is for a variant", () => {
  const variant = { _id: "v1", sku: "SKU-1-RED", price: 135, attachments: [{ _id: "va1" }] };
  const resolved = resolveListing(noOverrides, product, variant);
  assert.equal(resolved.price, 135);
  assert.deepEqual(resolved.photos, variant.attachments);
  assert.equal(resolved.title, product.title, "a variant has no title of its own");
});

test("resolveListing: a set override wins over the product value", () => {
  const photo = { _id: "o1" };
  const resolved = resolveListing(
    { title_override: "Custom", description_override: "<p>Custom</p>", price_override: 99, photo_overrides: [photo] },
    product,
    null,
  );
  assert.equal(resolved.title, "Custom");
  assert.equal(resolved.description, "<p>Custom</p>");
  assert.equal(resolved.price, 99);
  assert.deepEqual(resolved.photos, [photo]);
});

test("resolveListing: a price override of 0 is a real override, not a fall-through", () => {
  assert.equal(resolveListing({ ...noOverrides, price_override: 0 }, product, null).price, 0);
});
