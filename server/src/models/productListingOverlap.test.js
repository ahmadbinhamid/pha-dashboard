// models/productListingOverlap.test.js
// Guard: listing fields shadowing Product fields must default empty. No Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");

const Product = require("./Product");
const MarketplaceListing = require("./MarketplaceListing");

// Only fields that default empty and resolve "listing ?? product".
const ALLOWED_OVERLAPS = Object.freeze({
  ebay: {
    condition: "productFallbacks#resolveCondition; null = product's",
    "item_specifics.brand": "listing.resolver#resolveListing brand fallback",
    "item_specifics.mpn": "listing.resolver#resolveIdentifiers mpn fallback",
    "item_specifics.authenticity": "productFallbacks#resolveAuthenticity",
    "fitment.make": "productFallbacks#resolveFitment: empty fitment = product.vehicle",
    "fitment.model": "productFallbacks#resolveFitment",
    "fitment.model_code": "productFallbacks#resolveFitment",
    "fitment.year_from": "productFallbacks#resolveFitment",
    "fitment.year_to": "productFallbacks#resolveFitment",
  },
  google: {
    condition: "productFallbacks#resolveCondition, mapped by toGoogleCondition",
    mpn: "listing.resolver#resolveIdentifiers mpn fallback",
  },
});

// Bookkeeping every model carries; not product data.
const INFRASTRUCTURE = new Set(["_id", "__v", "tenant_id", "created_at", "updated_at", "deleted_at"]);

// Leaf paths of a schema, recursing into nested and array subdocuments.
function leafPaths(schema, prefix = "") {
  const out = [];
  schema.eachPath((path, type) => {
    const full = prefix + path;
    if (type.schema) out.push(...leafPaths(type.schema, `${full}.`));
    else out.push(full);
  });
  return out;
}

const leafName = (path) => path.split(".").at(-1);

const productNames = new Set(leafPaths(Product.schema).map(leafName).filter((n) => !INFRASTRUCTURE.has(n)));
const basePaths = new Set(leafPaths(MarketplaceListing.schema));

// Default of a path, or of the array that contains it (fitment rows).
function containerDefault(schema, path) {
  const parts = path.split(".");
  for (let i = 1; i <= parts.length; i++) {
    const type = schema.path(parts.slice(0, i).join("."));
    if (type?.$isMongooseDocumentArray || type?.instance === "Array") {
      return typeof type.defaultValue === "function" ? type.defaultValue() : type.defaultValue ?? [];
    }
  }
  const type = schema.path(path);
  return typeof type?.defaultValue === "function" ? type.defaultValue() : type?.defaultValue ?? null;
}

for (const [platform, discriminator] of Object.entries(MarketplaceListing.discriminators)) {
  test(`${platform} listing: every field shadowing a Product field is allowlisted and defaults empty`, () => {
    const allowed = ALLOWED_OVERLAPS[platform] ?? {};
    const own = leafPaths(discriminator.schema).filter((p) => !basePaths.has(p));
    const overlaps = own.filter((p) => productNames.has(leafName(p)));

    const unlisted = overlaps.filter((p) => !(p in allowed));
    assert.deepEqual(
      unlisted,
      [],
      `${platform} fields duplicate Product fields: default them to null, resolve "listing ?? product", then allowlist`,
    );

    for (const path of overlaps) {
      const value = containerDefault(discriminator.schema, path);
      const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
      assert.ok(empty, `${platform}.${path} must default to null/empty so the product value applies (got ${JSON.stringify(value)})`);
    }

    const stale = Object.keys(allowed).filter((p) => !overlaps.includes(p));
    assert.deepEqual(stale, [], `${platform} allowlist entries that no longer overlap: remove them`);
  });
}

test("the guard really catches a shadowing field with a default", () => {
  const { Schema } = require("mongoose");
  const bad = new Schema({ condition: { type: String, default: "NEW" }, brand_label: String });
  const own = leafPaths(bad).filter((p) => productNames.has(leafName(p)));
  assert.deepEqual(own, ["condition"], "a fourth copy of this bug would be flagged");
  assert.equal(containerDefault(bad, "condition"), "NEW", "and its non-empty default would fail the check");
});
