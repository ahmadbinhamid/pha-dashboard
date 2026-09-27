// services/marketplace/channelPrerequisite.service.test.js
// Lost storefront flags the connection, shows on /channels, clears. Mongo.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const ChannelConnection = require("../../models/ChannelConnection");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const Domain = require("../../models/Domain");
const registry = require("./registry");
const { httpError } = require("../../utils/http/httpError");

// Random key so nothing real is touched; the manifest declares the need.
const PLATFORM = `test-prereq-${crypto.randomUUID()}`;
const publish = mock.fn(async () => ({ external_listing_id: `ext-${crypto.randomUUID()}`, quantity: 2 }));
registry.register({
  key: PLATFORM,
  manifest: { key: PLATFORM, name: "Test Storefront Channel", requiresStorefront: true, fieldSchema: [] },
  capabilities: {},
  loadSettings: (tenantId) => ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM }).lean(),
  publish,
  update: publish,
  end: mock.fn(),
});

const { syncListing } = require("./sync.service");
const { listChannelsForTenant } = require("./channel.service");
const { reconcileTenantPrerequisites } = require("./channelPrerequisite.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function makeFixture() {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: PLATFORM, status: "connected", consecutive_failures: 0,
    status_reason: null, last_error: null, deleted_at: null,
  });
  const product = await Product.create({ tenant_id: tenantId, title: `Prereq ${suffix}`, slug: `prereq-${suffix}`, sku: `PRQ-${suffix}` });
  const { insertedId } = await MarketplaceListing.collection.insertOne({
    tenant_id: tenantId, product: product._id, variant: null, platform: PLATFORM, state: "active",
    sync_status: "pending", external_listing_id: null, last_pushed_seq: 0, deleted_at: null,
  });
  return { tenantId, listingId: insertedId, suffix };
}

const connectionOf = (tenantId) => ChannelConnection.collection.findOne({ tenant_id: tenantId, platform: PLATFORM });

async function addVerifiedDefaultDomain(tenantId) {
  await Domain.create({
    tenant_id: tenantId, hostname: `store-${crypto.randomUUID()}.example.com`, status: "active",
    is_default: true, verification_token: crypto.randomUUID(),
  });
}

test("a missing storefront flags the connection and skips sync without a failure or breaker count", async () => {
  const { tenantId, listingId } = await makeFixture();
  const callsBefore = publish.mock.callCount();

  const result = await syncListing(String(listingId));

  assert.deepEqual(result, { skipped: true, reason: "storefront_required" });
  assert.equal(publish.mock.callCount(), callsBefore, "the adapter is never called");
  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, "storefront_required");
  assert.match(conn.last_error, /Settings > Domains/);
  assert.equal(conn.consecutive_failures, 0, "a prerequisite is not a transport failure");
  const listing = await MarketplaceListing.collection.findOne({ _id: listingId });
  assert.equal(listing.sync_status, "error");
  assert.match(listing.sync_error, /verified default storefront domain/);
  assert.equal(await ChannelSyncLog.countDocuments({ tenant_id: tenantId, status: "failure" }), 0, "no per-listing failure rows");

  // Repeating the sync keeps it flagged and still never fails per listing.
  await syncListing(String(listingId));
  assert.equal((await connectionOf(tenantId)).consecutive_failures, 0);
  assert.equal(await ChannelSyncLog.countDocuments({ tenant_id: tenantId, status: "failure" }), 0);
});

test("GET /channels surfaces the reason and its remedy", async () => {
  const { tenantId, listingId } = await makeFixture();
  await syncListing(String(listingId));

  const channel = (await listChannelsForTenant(tenantId)).find((c) => c.key === PLATFORM);
  assert.equal(channel.connection.status, "error");
  assert.equal(channel.connection.status_reason, "storefront_required");
  assert.match(channel.connection.status_message, /Verify a domain under Settings > Domains/);
  assert.equal(channel.health_status, "needs_attention");
});

test("verifying a domain clears the flag through the normal path, with no breaker reset", async () => {
  const { tenantId, listingId } = await makeFixture();
  await syncListing(String(listingId));
  assert.equal((await connectionOf(tenantId)).status, "error");

  await addVerifiedDefaultDomain(tenantId);
  assert.deepEqual(await reconcileTenantPrerequisites(tenantId), [PLATFORM], "the domain hook clears it");
  const cleared = await connectionOf(tenantId);
  assert.equal(cleared.status, "connected");
  assert.equal(cleared.status_reason, null);
  assert.equal(cleared.last_error, null);

  const callsBefore = publish.mock.callCount();
  const result = await syncListing(String(listingId));
  assert.equal(result.ok, true, "the next sync publishes normally");
  assert.equal(publish.mock.callCount(), callsBefore + 1);
});

test("the next sync also clears the flag on its own once the prerequisite is met", async () => {
  const { tenantId, listingId } = await makeFixture();
  await syncListing(String(listingId));
  await addVerifiedDefaultDomain(tenantId);

  const result = await syncListing(String(listingId));
  assert.equal(result.ok, true);
  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "connected");
  assert.equal(conn.status_reason, null);
});

test("a per-item data error (missing GTIN) never flags the connection", async () => {
  const { tenantId, listingId } = await makeFixture();
  await addVerifiedDefaultDomain(tenantId);
  publish.mock.mockImplementationOnce(async () => {
    throw httpError("Missing required field: GTIN", 400);
  });

  await assert.rejects(syncListing(String(listingId)), /GTIN/);
  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "connected", "an item problem is not a broken connection");
  assert.equal(conn.status_reason, null);
  assert.equal(conn.consecutive_failures, 0);
  const log = await ChannelSyncLog.findOne({ tenant_id: tenantId, status: "failure" }).lean();
  assert.equal(log.error_status, 400, "the failure row keeps the status for later re-classification");
});
