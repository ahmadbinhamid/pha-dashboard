// services/marketplace/adapters/ebay.adapter.restock.test.js
// Sold-out eBay listings end cleanly at 0 and relist on restock. No Mongo.

const test = require("node:test");
const { mock, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ebayApiService = require("../../ebay/ebay.api.service");
const catalogService = require("../../ebay/ebay.catalog.service");
const { EBAY_ERROR_CODE } = require("../../../constants/ebay.constants");

mock.method(ebayApiService, "credentialsConfigured", () => true);
mock.method(ebayApiService, "getAccessToken", async () => "fake-token");
mock.method(ebayApiService, "buildOfferFromResolved", () => ({}));
mock.method(catalogService, "getConditionPolicies", async () => ({ conditions: [{ conditionId: "NEW" }] }));
const upsert = mock.method(ebayApiService, "upsertInventoryItem", async () => ({ ok: true }));
const updateOffer = mock.method(ebayApiService, "updateOffer", async () => ({ ok: true }));
const getOffer = mock.method(ebayApiService, "getOffer", async () => ({ status: "PUBLISHED", listing: { listingStatus: "ACTIVE" } }));
const publishOffer = mock.method(ebayApiService, "publishOffer", async () => "L-NEW");
const withdrawOffer = mock.method(ebayApiService, "withdrawOffer", async () => ({ ok: true }));

const ebayAdapter = require("./ebay.adapter");

const SETTINGS = { sandbox: true, marketplace_id: "EBAY_AU" };

const qtyError = () =>
  new ebayApiService.EbayApiError("upsert inventory_item failed: 400", {
    status: 400,
    body: JSON.stringify({ errors: [{ errorId: EBAY_ERROR_CODE.INVALID_LISTING_QUANTITY }] }),
  });

function resolvedFor(quantity) {
  return {
    sku: "RESTOCK-1",
    title: "Restock test",
    description: "d",
    price: 10,
    brand: null,
    photos: [],
    category: { id: "12345", source: "listing" },
    stock: { stock_control: true, quantity },
    listing: { tenant_id: "t1", condition: "NEW", item_specifics: {}, external_listing_id: "L-1", external_offer_id: "O-1" },
    product: { _id: "p1", stock_control: true },
    variant: null,
    condition: "NEW",
    authenticity: null,
    fitment: [],
  };
}

beforeEach(() => {
  for (const m of [upsert, updateOffer, getOffer, publishOffer, withdrawOffer]) m.mock.resetCalls();
  upsert.mock.mockImplementation(async () => ({ ok: true }));
  getOffer.mock.mockImplementation(async () => ({ status: "PUBLISHED", listing: { listingStatus: "ACTIVE" } }));
});

test("restock after eBay ended the listing: offer is republished, new listing id returned", async () => {
  getOffer.mock.mockImplementation(async () => ({ status: "PUBLISHED", listing: { listingStatus: "ENDED" } }));
  const result = await ebayAdapter.update(resolvedFor(3), SETTINGS, {});
  assert.equal(updateOffer.mock.callCount(), 1);
  assert.equal(publishOffer.mock.callCount(), 1);
  assert.equal(result.external_listing_id, "L-NEW");
  assert.equal(result.quantity, 3);
});

test("restock after we withdrew the offer (UNPUBLISHED): offer is republished", async () => {
  getOffer.mock.mockImplementation(async () => ({ status: "UNPUBLISHED" }));
  const result = await ebayAdapter.update(resolvedFor(2), SETTINGS, {});
  assert.equal(publishOffer.mock.callCount(), 1);
  assert.equal(result.external_listing_id, "L-NEW");
});

test("live listing: price/qty update only, no republish", async () => {
  const result = await ebayAdapter.update(resolvedFor(5), SETTINGS, {});
  assert.equal(publishOffer.mock.callCount(), 0);
  assert.equal(result.external_listing_id, "L-1");
});

test("listing ended by eBay for policy is never auto-relisted", async () => {
  getOffer.mock.mockImplementation(async () => ({ status: "UNPUBLISHED", listing: { listingStatus: "EBAY_ENDED" } }));
  await ebayAdapter.update(resolvedFor(5), SETTINGS, {});
  assert.equal(publishOffer.mock.callCount(), 0);
});

test("qty 0 refused (25004): offer withdrawn, 0 retried and stamped, sync succeeds", async () => {
  let calls = 0;
  upsert.mock.mockImplementation(async () => {
    if (calls++ === 0) throw qtyError();
    return { ok: true };
  });
  const onQuantityPushed = mock.fn(async () => {});
  const result = await ebayAdapter.update(resolvedFor(0), SETTINGS, { onQuantityPushed });
  assert.equal(withdrawOffer.mock.callCount(), 1);
  assert.equal(upsert.mock.callCount(), 2);
  assert.deepEqual(onQuantityPushed.mock.calls.map((c) => c.arguments[0]), [0]);
  assert.equal(result.quantity, 0, "sync.service marks OUT_OF_STOCK from this");
  assert.equal(getOffer.mock.callCount(), 0, "no relist check at 0");
});

test("qty 0 still refused after withdraw: no throw, baseline left alone", async () => {
  upsert.mock.mockImplementation(async () => {
    throw qtyError();
  });
  withdrawOffer.mock.mockImplementationOnce(async () => {
    throw new Error("already ended");
  });
  const onQuantityPushed = mock.fn(async () => {});
  const result = await ebayAdapter.update(resolvedFor(0), SETTINGS, { onQuantityPushed });
  assert.equal(result.quantity, 0);
  assert.equal(onQuantityPushed.mock.callCount(), 0);
});

test("other upsert errors still fail the sync", async () => {
  upsert.mock.mockImplementation(async () => {
    throw new ebayApiService.EbayApiError("boom", { status: 400, body: "{}" });
  });
  await assert.rejects(ebayAdapter.update(resolvedFor(0), SETTINGS, {}), /boom/);
  assert.equal(withdrawOffer.mock.callCount(), 0);
});
