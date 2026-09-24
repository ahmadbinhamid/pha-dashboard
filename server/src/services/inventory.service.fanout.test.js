// services/inventory.service.fanout.test.js
// Fan-out skips adapterless listings; isolates platform failures. Needs Mongo.

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
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

  // try/finally so a failed assertion still disconnects instead of hanging.
  try {
    const Product = require("../models/Product");
    const MarketplaceListing = require("../models/MarketplaceListing");
    const { LISTING_STATE } = require("../constants/marketplace.constants");

    const suffix = crypto.randomUUID();
    const tenantId = fixtureId();

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
    // No discriminator for "amazon"/"shopify", so insert via the raw collection.
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

    // Failure is isolated per platform: eBay's enqueue was still attempted.
    const ebayCalls = enqueueSpy.mock.calls.filter((c) => c.arguments[0] === "ebay");
    assert.equal(ebayCalls.length, 1);
  } finally {
    await mongoose.disconnect();
  }
});
