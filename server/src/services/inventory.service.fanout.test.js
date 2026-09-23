// services/inventory.service.fanout.test.js
// Regression guard: fanOutMarketplaceInventory must skip a listing with no registered adapter
// (never throw), and one platform's enqueue failure must never block another's.
// Mocks enqueueChannelJob directly, patched before inventory.service.js is first required.
// Needs a live Mongo connection. Run: node --test src/services/inventory.service.fanout.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");

const channelQueueModule = require("../queues/channel.queue");
const enqueueSpy = mock.method(channelQueueModule, "enqueueChannelJob", async (platform) => {
  if (platform === "amazon") throw new Error("simulated amazon queue outage");
  return { id: `fake-job-${platform}` };
});

const registry = require("./marketplace/registry");
registry.register({ key: "ebay", publish: mock.fn(), update: mock.fn(), end: mock.fn() });
registry.register({ key: "amazon", publish: mock.fn(), update: mock.fn(), end: mock.fn() });
// "shopify" deliberately left unregistered — exercises the "no adapter" skip.

const { fanOutMarketplaceInventory } = require("./inventory.service");

test("fan-out: skips a listing whose platform has no adapter, and one platform's enqueue failure does not block others", async (t) => {
  await mongoose.connect(config.mongoUri);

  // try/finally so a future assertion failure disconnects Mongo cleanly instead of hanging the suite.
  try {
    const Product = require("../models/Product");
    const MarketplaceListing = require("../models/MarketplaceListing");
    const { LISTING_STATE } = require("../constants/marketplace.constants");

    const suffix = crypto.randomUUID();
    const tenantId = new mongoose.Types.ObjectId();

    const product = await Product.create({
      tenant_id: tenantId,
      title: `Fan-out test ${suffix}`,
      slug: `fanout-test-${suffix}`,
      sku: `FANOUT-${suffix}`,
      status: "active",
    });

    await MarketplaceListing.create({
      tenant_id: tenantId,
      product: product._id,
      variant: null,
      platform: "ebay",
      state: LISTING_STATE.ACTIVE,
      condition: "NEW",
    });
    // "amazon"/"shopify" have no Mongoose discriminator registered yet, so .create() would
    // reject them — inserted directly via the raw collection instead.
    await mongoose.connection.db.collection("marketplacelistings").insertMany([
      {
        tenant_id: tenantId,
        product: product._id,
        variant: null,
        platform: "amazon",
        state: LISTING_STATE.ACTIVE,
        sync_status: "not_listed",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        tenant_id: tenantId,
        product: product._id,
        variant: null,
        platform: "shopify",
        state: LISTING_STATE.ACTIVE,
        sync_status: "not_listed",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const results = await fanOutMarketplaceInventory(product._id, null, tenantId);
    const byPlatform = Object.fromEntries(results.map((r) => [r.platform, r]));

    assert.equal(byPlatform.shopify.queued, false, "an unregistered platform must never be queued");
    assert.equal(byPlatform.shopify.error, "no_adapter");

    assert.equal(byPlatform.ebay.queued, true, "eBay's own enqueue must succeed independently of amazon's failure");

    assert.equal(byPlatform.amazon.queued, false, "amazon's simulated queue outage must be reported, not thrown");
    assert.match(byPlatform.amazon.error, /simulated amazon queue outage/);

    // Confirm the failure was isolated per platform: eBay's enqueue was actually attempted.
    const ebayCalls = enqueueSpy.mock.calls.filter((c) => c.arguments[0] === "ebay");
    assert.equal(ebayCalls.length, 1);
  } finally {
    await mongoose.disconnect();
  }
});
