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
const deleteOffer = mock.method(ebayApiService, "deleteOffer", async () => ({ ok: true }));
const createOffer = mock.method(ebayApiService, "createOffer", async () => "O-FRESH");
const deleteProduct = mock.method(ebayApiService, "deleteProduct", async () => ({ ok: true }));
const updatePriceQuantity = mock.method(ebayApiService, "updatePriceQuantity", async () => ({ ok: true }));
mock.method(ebayApiService, "ensureLocation", async () => {});

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
  for (const m of [upsert, updateOffer, getOffer, publishOffer, withdrawOffer, deleteOffer, createOffer, deleteProduct, updatePriceQuantity]) m.mock.resetCalls();
  updatePriceQuantity.mock.mockImplementation(async () => ({ ok: true }));
  deleteProduct.mock.mockImplementation(async () => ({ ok: true }));
  publishOffer.mock.mockImplementation(async () => "L-NEW");
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

test("sold-out relist refused with 'Availability not found': fresh offer replaces it", async () => {
  getOffer.mock.mockImplementation(async () => ({ status: "PUBLISHED", listing: { listingStatus: "ENDED" } }));
  let publishes = 0;
  publishOffer.mock.mockImplementation(async () => {
    publishes += 1;
    if (publishes === 1) {
      throw new ebayApiService.EbayApiError("publishOffer failed: 400 Input error. Availability not found.", {
        status: 400,
        body: JSON.stringify({ errors: [{ errorId: 25002, message: "Input error. Availability not found." }] }),
      });
    }
    return "L-FRESH";
  });
  const saved = [];
  const result = await ebayAdapter.update(resolvedFor(3), SETTINGS, { onOfferCreated: async (id) => saved.push(id) });

  assert.equal(deleteOffer.mock.calls[0].arguments[2], "O-1", "the dead offer is removed");
  assert.equal(createOffer.mock.callCount(), 1);
  assert.deepEqual(saved, ["O-FRESH"], "new offer id saved before publishing");
  assert.equal(result.external_offer_id, "O-FRESH");
  assert.equal(result.external_listing_id, "L-FRESH");
});

const stuckError = () =>
  new ebayApiService.EbayApiError("upsert inventory_item failed: 500", {
    status: 500,
    body: JSON.stringify({ errors: [{ errorId: EBAY_ERROR_CODE.SYSTEM_ERROR, message: "A system error has occurred." }] }),
  });

// Sold out on eBay last time (baseline 0), with policies so publish can run.
function soldOutResolved(quantity) {
  const resolved = resolvedFor(quantity);
  resolved.listing = {
    ...resolved.listing,
    ebay_synced_quantity: 0,
    fulfillment_policy_id: "F",
    payment_policy_id: "P",
    return_policy_id: "R",
  };
  return resolved;
}

test("stuck SKU after selling out: eBay record deleted, same SKU published fresh", async () => {
  // Stuck records can't even be read, as seen in production.
  getOffer.mock.mockImplementation(async () => {
    throw stuckError();
  });
  let calls = 0;
  upsert.mock.mockImplementation(async () => {
    calls += 1;
    if (calls === 1) throw stuckError();
    return { ok: true };
  });
  const saved = [];
  const result = await ebayAdapter.update(soldOutResolved(3), SETTINGS, { onOfferCreated: async (id) => saved.push(id) });

  const [, sku, offerId] = deleteProduct.mock.calls[0].arguments;
  assert.equal(sku, "RESTOCK-1", "same SKU, never rotated");
  assert.equal(offerId, "O-1");
  assert.equal(result.external_offer_id, "O-FRESH");
  assert.equal(result.external_listing_id, "L-NEW");
  assert.deepEqual(saved, ["O-FRESH"]);
});

test("stuck item on a live listing: never deleted, stock set via price/qty update", async () => {
  upsert.mock.mockImplementation(async () => {
    throw stuckError();
  });
  const resolved = soldOutResolved(3);
  resolved.listing.ebay_synced_quantity = 2;
  const pushed = [];
  const result = await ebayAdapter.update(resolved, SETTINGS, { onQuantityPushed: async (q) => pushed.push(q) });
  assert.equal(deleteProduct.mock.callCount(), 0, "a live listing is never deleted");
  assert.deepEqual(updatePriceQuantity.mock.calls[0].arguments[2], { sku: "RESTOCK-1", offerId: "O-1", quantity: 3, price: undefined });
  assert.deepEqual(pushed, [3], "baseline stamped");
  assert.equal(result.external_listing_id, "L-1", "same listing kept");
});

test("eBay can't delete the stuck record: clear, non-breaker 422", async () => {
  upsert.mock.mockImplementation(async () => {
    throw stuckError();
  });
  deleteProduct.mock.mockImplementation(async () => ({ error: "500: system error", status: 500 }));
  getOffer.mock.mockImplementation(async () => {
    throw stuckError();
  });
  await assert.rejects(
    () => ebayAdapter.update(soldOutResolved(3), SETTINGS, {}),
    (err) => err.status === 422 && /Contact eBay support/.test(err.message),
  );
});

test("hidden out-of-stock listing: restocked in place, never reset", async () => {
  upsert.mock.mockImplementation(async () => {
    throw stuckError();
  });
  getOffer.mock.mockImplementation(async () => ({ status: "PUBLISHED", listing: { listingStatus: "OUT_OF_STOCK" } }));
  const result = await ebayAdapter.update(soldOutResolved(3), SETTINGS, {});
  assert.equal(deleteProduct.mock.callCount(), 0);
  assert.equal(updatePriceQuantity.mock.callCount(), 1);
  assert.equal(result.external_offer_id, "O-1");
});

test("price/qty fallback also refused: the sync fails with eBay's error", async () => {
  upsert.mock.mockImplementation(async () => {
    throw stuckError();
  });
  updatePriceQuantity.mock.mockImplementation(async () => {
    throw stuckError();
  });
  await assert.rejects(() => ebayAdapter.update(soldOutResolved(3), SETTINGS, {}), /upsert inventory_item failed: 500/);
});

test("listing eBay reports as ENDED is reset", async () => {
  let calls = 0;
  upsert.mock.mockImplementation(async () => {
    calls += 1;
    if (calls === 1) throw stuckError();
    return { ok: true };
  });
  getOffer.mock.mockImplementation(async () => ({ status: "PUBLISHED", listing: { listingStatus: "ENDED" } }));
  const result = await ebayAdapter.update(soldOutResolved(3), SETTINGS, {});
  assert.equal(deleteProduct.mock.callCount(), 1);
  assert.equal(result.external_offer_id, "O-FRESH");
});
