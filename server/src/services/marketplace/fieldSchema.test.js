// services/marketplace/fieldSchema.test.js
// fieldSchema contract: real fields only, and rules enforced in the mappers. No Mongo.

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");

// Must be mocked before ebay.adapter.js is required.
const ebayApi = require("../ebay/ebay.api.service");
mock.method(ebayApi, "credentialsConfigured", () => true);
mock.method(ebayApi, "getAccessToken", async () => "tok");
const upsertSpy = mock.method(ebayApi, "upsertInventoryItem", async () => ({}));
const createOfferSpy = mock.method(ebayApi, "createOffer", async () => "offer-1");
mock.method(require("../ebay/ebay.catalog.service"), "getConditionPolicies", async () => ({ conditions: [{ conditionId: "NEW" }] }));

const MarketplaceListing = require("../../models/MarketplaceListing");
const { validateFieldValues, withStaticOptions, ChannelFieldValidationError } = require("./fieldSchema");
const ebayAdapter = require("./adapters/ebay.adapter");
const googleAdapter = require("./adapters/google.adapter");

const DESCRIPTOR_KEYS = ["key", "label", "type", "required", "helpText", "optionsSource", "group"];

for (const adapter of [ebayAdapter, googleAdapter]) {
  test(`${adapter.key} fieldSchema: well-formed descriptors naming only real listing fields`, () => {
    const schema = adapter.manifest.fieldSchema;
    assert.ok(Array.isArray(schema) && schema.length > 0);
    const discriminator = MarketplaceListing.discriminators[adapter.key].schema;
    for (const d of schema) {
      assert.deepEqual(Object.keys(d).filter((k) => !DESCRIPTOR_KEYS.includes(k)), [], `${d.key}: unknown descriptor keys`);
      assert.equal(typeof d.label, "string");
      assert.equal(typeof d.required, "boolean");
      assert.ok(discriminator.path(d.key) || discriminator.pathType(d.key) === "nested", `${d.key} must be a real ${adapter.key} listing field`);
    }
  });
}

test("google fieldSchema omits connection-level feed settings (read from ChannelConnection, not the listing)", () => {
  const keys = googleAdapter.manifest.fieldSchema.map((d) => d.key);
  assert.ok(!keys.includes("feed_label") && !keys.includes("content_language"));
});

test("validateFieldValues: required, number and enforced-option rules", () => {
  const schema = [
    { key: "a", label: "A", type: "text", required: true },
    { key: "n", label: "N", type: "number", required: false },
    { key: "c", label: "C", type: "select", required: false, optionsSource: "google.conditions" },
  ];
  assert.deepEqual(validateFieldValues(schema, { a: " ", n: "x", c: "broken" }).map((e) => e.field), ["a", "n", "c"]);
  assert.deepEqual(validateFieldValues(schema, { a: "ok", n: 3, c: "used" }), []);
  assert.deepEqual(validateFieldValues(schema, {}, { keys: ["n"] }), [], "keys limits which rules run");
});

test("withStaticOptions attaches static option lists for the frontend", () => {
  const served = withStaticOptions(googleAdapter.manifest.fieldSchema);
  assert.deepEqual(served.find((d) => d.key === "condition").options.map((o) => o.value), ["new", "refurbished", "used"]);
  assert.equal(served.find((d) => d.key === "gtin").options, undefined);
});

function ebayResolved(listing, title = "Front Brake Disc") {
  return {
    sku: "SKU-1", title, description: "d", price: 10, brand: null, photos: [], category: null,
    listing: { tenant_id: "t1", condition: "NEW", ebay_category_id: "33564", item_specifics: {}, ...listing },
    product: { _id: "p1", stock_control: false }, variant: null,
  };
}

test("eBay mapper: an over-long EFFECTIVE title is rejected before any eBay write", async () => {
  const before = upsertSpy.mock.callCount();
  await assert.rejects(
    () => ebayAdapter.update(ebayResolved({}, "x".repeat(81)), {}),
    (err) => err instanceof ChannelFieldValidationError && /Product title is 81 characters/.test(err.message),
  );
  assert.equal(upsertSpy.mock.callCount(), before, "nothing pushed");
});

test("eBay mapper: first publish needs all three business policies (listing or tenant default)", async () => {
  const offersBefore = createOfferSpy.mock.callCount();
  await assert.rejects(
    () => ebayAdapter.publish(ebayResolved({}), { payment_policy_id: "pay-default" }),
    (err) => err.code === "FIELD_VALIDATION" && err.errors.map((e) => e.field).join() === "fulfillment_policy_id,return_policy_id",
  );
  assert.equal(createOfferSpy.mock.callCount(), offersBefore, "no offer created");
});

test("Google mapper: an invalid condition is rejected before any Merchant API call", async () => {
  const fetchSpy = mock.method(global, "fetch", async () => ({ ok: true, json: async () => ({}) }));
  const resolved = {
    sku: "G-1", title: "t", description: "d", price: 1, photos: [{ url: "https://cdn/a.jpg" }], category: null,
    listing: { tenant_id: "t1", condition: "mint" }, product: { _id: "p1", stock_control: true, slug: "s" },
  };
  await assert.rejects(
    () => googleAdapter.publish(resolved, { refresh_token_ct: "x", merchant_id: "m", data_source_id: "d" }),
    (err) => err.code === "FIELD_VALIDATION" && err.status === 400,
  );
  assert.equal(fetchSpy.mock.callCount(), 0);
  fetchSpy.mock.restore();
});
