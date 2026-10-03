// services/shipping/shippingQuote.service.test.js
// Cart shipping rules with Transdirect mocked, on fixture tenants.

const test = require("node:test");
const { before, after, mock, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const Product = require("../../models/Product");

const settingsService = require("./shippingSettings.service");
const transdirect = require("./transdirect.api.service");
const SENDER = { postcode: "2000", suburb: "SYDNEY", state: "NSW", type: "business" };
const SITE = "https://shop.example.test/";
const getConfig = mock.method(settingsService, "getTransdirectConfig", async () => ({ apiKey: "k", sender: SENDER, requestingSite: SITE }));
const quoteShipment = mock.method(transdirect, "quoteShipment", async () => [
  { courier: "tnt", total: 20.5, service: "road", transit_time: "2 days" },
  { courier: "allied", total: 31, service: "road", transit_time: "1 day" },
]);

const { quoteCart, hasCalculatedShipping, findPickupOnlyTitles } = require("./shippingQuote.service");
const { toQuotes } = transdirect;
const { updateSettings, getSettings } = require("./shippingSettings.service");

const RECEIVER = { postcode: "3000", suburb: "Melbourne" };
const PKG = { length: 30, width: 20, height: 10, weight: 1.5 };

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());
beforeEach(() => {
  quoteShipment.mock.resetCalls();
  getConfig.mock.mockImplementation(async () => ({ apiKey: "k", sender: SENDER, requestingSite: SITE }));
});

const product = (tenantId, extra) => {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: tenantId, title: `Ship ${suffix}`, slug: `ship-${suffix}`, is_published_online: true, price: 50, ...extra });
};

test("standard-only cart: flat rate per unit, Transdirect never called", async () => {
  const tenantId = fixtureId();
  const p = await product(tenantId, { shipping_cost: 15 });
  const result = await quoteCart(tenantId, { items: [{ product: p._id, quantity: 3 }], receiver: RECEIVER });
  assert.equal(result.shipping_cost, 4500);
  assert.equal(result.calculated, null);
  assert.equal(quoteShipment.mock.callCount(), 0);
  assert.equal(await hasCalculatedShipping(tenantId, [{ product: p._id }]), false);
});

test("pickup-only product: no flat rate kept or charged, and it is flagged", async () => {
  const tenantId = fixtureId();
  const pickup = await product(tenantId, { shipping_method: "pickup", shipping_cost: 25 });
  const flat = await product(tenantId, { shipping_cost: 10 });
  assert.equal(pickup.shipping_cost, null, "model clears the stale flat rate");
  const items = [{ product: pickup._id, quantity: 2 }, { product: flat._id, quantity: 1 }];
  const result = await quoteCart(tenantId, { items, receiver: RECEIVER });
  assert.equal(result.shipping_cost, 1000);
  assert.deepEqual(await findPickupOnlyTitles(tenantId, items), [pickup.title]);
});

test("mixed cart: flat + cheapest courier, and the quote is reused", async () => {
  const tenantId = fixtureId();
  const flat = await product(tenantId, { shipping_cost: 10 });
  const calc = await product(tenantId, { shipping_method: "calculated", package: PKG });
  const items = [{ product: flat._id, quantity: 1 }, { product: calc._id, quantity: 2 }];

  const result = await quoteCart(tenantId, { items, receiver: RECEIVER });
  assert.equal(result.standard_cost, 1000);
  assert.equal(result.calculated_cost, 2050);
  assert.equal(result.shipping_cost, 3050);
  assert.equal(result.calculated.courier, "tnt");
  const sent = quoteShipment.mock.calls[0].arguments[1];
  assert.deepEqual(sent.items, [{ ...PKG, quantity: 2 }], "only the calculated line, with its package");
  assert.equal(sent.receiver.type, "residential");
  assert.equal(sent.requestingSite, SITE, "the store's own website");

  await quoteCart(tenantId, { items, receiver: { ...RECEIVER, suburb: "MELBOURNE" } });
  assert.equal(quoteShipment.mock.callCount(), 1, "same cart and address: cached");
});

test("tailgate flags and the customer's address type reach Transdirect", async () => {
  const tenantId = fixtureId();
  const heavy = await product(tenantId, { shipping_method: "calculated", package: PKG, tailgate_delivery: true });
  const light = await product(tenantId, { shipping_method: "calculated", package: PKG });
  const items = [{ product: heavy._id, quantity: 1 }, { product: light._id, quantity: 1 }];

  await quoteCart(tenantId, { items, receiver: { ...RECEIVER, address_type: "business" } });
  const sent = quoteShipment.mock.calls[0].arguments[1];
  assert.equal(sent.tailgateDelivery, true, "one heavy item needs it for the shipment");
  assert.equal(sent.tailgatePickup, false);
  assert.equal(sent.receiver.type, "business");

  await quoteCart(tenantId, { items, receiver: RECEIVER });
  assert.equal(quoteShipment.mock.callCount(), 2, "a different address type is a new quote");
  assert.equal(quoteShipment.mock.calls[1].arguments[1].receiver.type, "residential");
});

test("calculated product without full package dimensions is refused", async () => {
  const tenantId = fixtureId();
  const calc = await product(tenantId, { shipping_method: "calculated", package: { length: 30, weight: 2 } });
  await assert.rejects(quoteCart(tenantId, { items: [{ product: calc._id, quantity: 1 }], receiver: RECEIVER }), (err) => err.status === 422 && /package/.test(err.message));
});

test("calculated shipping without Transdirect set up is a clear 422", async () => {
  const tenantId = fixtureId();
  getConfig.mock.mockImplementation(async () => null);
  const calc = await product(tenantId, { shipping_method: "calculated", package: PKG });
  await assert.rejects(quoteCart(tenantId, { items: [{ product: calc._id, quantity: 1 }], receiver: RECEIVER }), (err) => err.status === 422);
});

test("toQuotes flattens Transdirect's courier map, cheapest first", () => {
  const quotes = toQuotes({ a: { total: 30 }, b: { total: "12.5", transit_time: "1 day" }, c: { total: null } });
  assert.deepEqual(quotes.map((q) => [q.courier, q.total]), [["b", 12.5], ["a", 30]]);
});

test("settings never return the API key; a blank key keeps the saved one", async () => {
  const tenantId = fixtureId();
  const saved = await updateSettings(tenantId, { api_key: "secret-key", sender_postcode: "2000", sender_suburb: "SYDNEY" });
  assert.equal(saved.transdirect_configured, true);
  assert.ok(!JSON.stringify(saved).includes("secret-key"));
  await updateSettings(tenantId, { api_key: "", sender_suburb: "HAYMARKET" });
  const read = await getSettings(tenantId);
  assert.equal(read.transdirect_configured, true);
  assert.equal(read.sender_suburb, "HAYMARKET");
});
