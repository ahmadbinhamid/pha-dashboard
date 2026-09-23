// services/marketplace/adapters/ebay.adapter.zero-quantity.test.js
//
// Regression guard: a manual stock correction to 0 must actually reach
// eBay. Before this fix, publish()/update() both had an early
// `if (quantity === 0) return { skipped: true, reason: "out_of_stock" }`
// BEFORE any write — and a manual dashboard stock correction reaches eBay
// ONLY via fan-out -> sync_listing -> update(). The result: correcting stock
// to 0 in the dashboard silently never told eBay, which kept selling stock
// that didn't exist. eBay must now receive the real 0.
//
// TASK 4: the adapter is now a pure translator — quantity arrives on
// resolved.stock and the sync baseline is stamped by sync.service.js via
// hooks.onQuantityPushed. So this file runs WITHOUT Mongo and asserts the
// hook call; the DB baseline itself is asserted end to end in
// sync.service.baseline.test.js (same two scenarios).
//
// Mocks ebay.api.service's credentialsConfigured/getAccessToken/
// upsertInventoryItem (destructured by ebay.adapter.js at require time, so
// installed BEFORE it is first required). buildInventoryItemFromResolved is
// left real, so this also exercises its null-quantity omission logic.

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");

const ebayApiService = require("../../ebay/ebay.api.service");
mock.method(ebayApiService, "credentialsConfigured", () => true);
mock.method(ebayApiService, "getAccessToken", async () => "fake-token");
const upsertInventoryItemSpy = mock.method(ebayApiService, "upsertInventoryItem", async () => ({ ok: true }));

const ebayAdapter = require("./ebay.adapter");

const SETTINGS = { sandbox: true, marketplace_id: "EBAY_AU" };

// ebay_category_id deliberately unset — update() then returns right after the
// inventory-item write (the part this test cares about).
function resolvedFor({ stockControl, quantity }) {
  return {
    sku: "ZEROQ-1",
    title: "Zero quantity test",
    description: "d",
    price: 10,
    brand: null,
    photos: [],
    category: null,
    stock: { stock_control: stockControl, quantity: stockControl ? quantity : null },
    listing: {
      tenant_id: "t1",
      condition: "NEW",
      item_specifics: {},
      external_listing_id: "L-1",
      external_offer_id: "O-1",
    },
    product: { _id: "p1", stock_control: stockControl },
    variant: null,
  };
}

test("manual correction to 0 (stock_control=true): quantity 0 is pushed to eBay, not skipped", async () => {
  const onQuantityPushed = mock.fn(async () => {});
  const callsBefore = upsertInventoryItemSpy.mock.callCount();

  const result = await ebayAdapter.update(resolvedFor({ stockControl: true, quantity: 0 }), SETTINGS, { onQuantityPushed });

  assert.notEqual(result.skipped, true, "must not be skipped as out_of_stock — it must actually push 0");
  assert.equal(result.quantity, 0);
  assert.equal(upsertInventoryItemSpy.mock.callCount(), callsBefore + 1, "the inventory item write must actually happen");

  const pushedBody = upsertInventoryItemSpy.mock.calls.at(-1).arguments[2];
  assert.equal(pushedBody.availability.shipToLocationAvailability.quantity, 0, "eBay must receive the true 0, not a skipped write");

  assert.deepEqual(onQuantityPushed.mock.calls.map((c) => c.arguments[0]), [0], "baseline must reflect the confirmed 0 push");
});

test("stock_control=false: no quantity is ever sent to eBay, and the baseline hook is never called", async () => {
  const onQuantityPushed = mock.fn(async () => {});
  const callsBefore = upsertInventoryItemSpy.mock.callCount();

  const result = await ebayAdapter.update(resolvedFor({ stockControl: false }), SETTINGS, { onQuantityPushed });

  assert.equal(result.quantity, null);
  assert.equal(upsertInventoryItemSpy.mock.callCount(), callsBefore + 1, "the inventory item call still happens (title/condition/etc still sync)");

  const pushedBody = upsertInventoryItemSpy.mock.calls.at(-1).arguments[2];
  assert.equal(pushedBody.availability, undefined, "no availability block at all for an untracked-stock product");

  assert.equal(onQuantityPushed.mock.callCount(), 0, "the baseline must never be stamped for a null (untracked) quantity");
});

test("eBay treats an UNSET stock_control as untracked (null quantity) — unlike Google, kept distinct", async () => {
  const resolved = resolvedFor({ stockControl: true, quantity: 4 });
  resolved.product.stock_control = undefined;
  const result = await ebayAdapter.update(resolved, SETTINGS, {});
  assert.equal(result.quantity, null);
});
