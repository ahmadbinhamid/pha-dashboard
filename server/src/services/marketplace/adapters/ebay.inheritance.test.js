// services/marketplace/adapters/ebay.inheritance.test.js
// Empty eBay condition/MPN inherit the product's; set ones override. No Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildInventoryItemFromResolved } = require("../../ebay/ebay.api.service");
const { fieldValues, effectiveMpn } = require("./ebay.fieldSchema");
const { descriptionInputFromResolved } = require("../../ebay/ebay.description.template");

const product = { _id: "p1", sku: "S1", mpn: "LR010632", condition: "USED", brand: "Land Rover" };

function resolved(listing) {
  return { sku: "S1", title: "Flare", description: "d", brand: product.brand, photos: [], listing, product };
}

test("empty listing MPN/condition fall back to the product", () => {
  const listing = { condition: null, item_specifics: { mpn: null } };
  const item = buildInventoryItemFromResolved(resolved(listing), 1);
  assert.equal(item.product.mpn, "LR010632");
  assert.equal(item.condition, "USED_EXCELLENT", "product USED maps to eBay's used grade");
  assert.equal(fieldValues(listing, { product }).condition, "USED");
  assert.equal(effectiveMpn(listing, product), "LR010632");
  assert.equal(descriptionInputFromResolved(resolved(listing)).mpn, "LR010632");
});

test("a set listing MPN/condition overrides the product", () => {
  const listing = { condition: "NEW", item_specifics: { mpn: "EBAY-ONLY" } };
  const item = buildInventoryItemFromResolved(resolved(listing), 1);
  assert.equal(item.product.mpn, "EBAY-ONLY");
  assert.equal(item.condition, "NEW");
  assert.equal(fieldValues(listing, { product }).condition, "NEW");
});
