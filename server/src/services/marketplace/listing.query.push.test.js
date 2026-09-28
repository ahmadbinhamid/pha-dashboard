// services/marketplace/listing.query.push.test.js
// A manual re-sync resumes a paused channel before queueing. Needs Mongo.

const test = require("node:test");
const { mock, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");
require("../../models/index");
const MarketplaceListing = require("../../models/MarketplaceListing");

const channelQueue = require("../../queues/channel.queue");
const enqueue = mock.method(channelQueue, "enqueueChannelJob", async () => ({ id: "job" }));
const circuitBreaker = require("./circuitBreaker");
const isOpen = mock.method(circuitBreaker, "isOpen", async () => true);
const resume = mock.method(circuitBreaker, "resume", async () => {});
const { pushListing } = require("./listing.query.service");

const created = [];
before(() => mongoose.connect(config.mongoUri));
after(async () => {
  await MarketplaceListing.collection.deleteMany({ _id: { $in: created } });
  await mongoose.disconnect();
});

async function listing() {
  const tenantId = fixtureId();
  const { insertedId } = await MarketplaceListing.collection.insertOne({
    tenant_id: tenantId,
    platform: "ebay",
    product: new mongoose.Types.ObjectId(),
    external_listing_id: `L-${crypto.randomUUID()}`,
    external_offer_id: `O-${crypto.randomUUID()}`,
  });
  created.push(insertedId);
  return { id: insertedId, tenantId };
}

test("paused channel: manual re-sync resumes it, then queues the sync", async () => {
  const { id, tenantId } = await listing();
  await pushListing(id, tenantId);
  assert.equal(resume.mock.callCount(), 1);
  assert.equal(enqueue.mock.callCount(), 1);
});

test("healthy channel: nothing to resume", async () => {
  resume.mock.resetCalls();
  isOpen.mock.mockImplementation(async () => false);
  const { id, tenantId } = await listing();
  await pushListing(id, tenantId);
  assert.equal(resume.mock.callCount(), 0);
});
