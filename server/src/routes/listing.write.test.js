// routes/listing.write.test.js
// Generic /listings create/update match the old platform routes exactly.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
// Captured from the pre-refactor /ebay/listings and /google/listings routes.
const GOLDEN = require("../testUtils/fixtures/listingWriteGolden.json");

// Before app loads: no real queue jobs, but record what would be queued.
const channelQueue = require("../queues/channel.queue");
const enqueued = [];
mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
  enqueued.push(args);
});

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const MarketplaceListing = require("../models/MarketplaceListing");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

const VOLATILE = new Set(["_id", "tenant_id", "product", "variant", "created_at", "updated_at", "__v", "id"]);
const strip = (doc) => JSON.parse(JSON.stringify(doc, (k, v) => (VOLATILE.has(k) ? undefined : v)));
const PLATFORMS = ["ebay", "google"];

let server;
let baseUrl;
let token;
let tenantId;

async function makeTenantUser() {
  const id = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: id, name: `Listing ${suffix}`, slug: `listing-${suffix}`, code: `LI${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(id);
  const { insertedId } = await User.collection.insertOne({
    tenant_id: id, first_name: "Li", last_name: "Sting", email: `listing-${suffix}@example.com`,
    password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
  });
  await addMember({ tenantId: id, userId: insertedId, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
  return { tenantId: id, token: signJwt({ sub: String(insertedId), role: "user" }) };
}

before(async () => {
  await mongoose.connect(config.mongoUri);
  ({ tenantId, token } = await makeTenantUser());
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
});

async function call(method, path, body, as = token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${as}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const makeProduct = (owner = tenantId) => {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: owner, title: `P ${suffix}`, slug: `p-${suffix}`, sku: `P-${suffix}` });
};

// Create then update via a route pair; returns stored docs and responses.
async function createAndUpdate(platform, { createPath, updatePath, extraBody = {} }) {
  const product = await makeProduct();
  const { payloads } = GOLDEN[platform];
  const created = await call("POST", createPath, { ...extraBody, ...payloads.create, product: String(product._id) });
  const id = created.body.data._id;
  const storedAfterCreate = strip(await MarketplaceListing.findById(id).lean());
  const updated = await call("PUT", updatePath(id), { ...payloads.update, product: String(product._id) });
  const storedAfterUpdate = strip(await MarketplaceListing.findById(id).lean());
  return { created, updated, storedAfterCreate, storedAfterUpdate };
}

function assertMatchesGolden(platform, result) {
  const golden = GOLDEN[platform];
  assert.equal(result.created.status, golden.create.status);
  assert.equal(result.created.body.message, golden.create.message);
  assert.deepEqual(Object.keys(result.created.body.data).sort(), golden.create.dataKeys);
  assert.deepEqual(result.storedAfterCreate, golden.storedAfterCreate);
  assert.equal(result.updated.status, golden.update.status);
  assert.equal(result.updated.body.message, golden.update.message);
  assert.deepEqual(Object.keys(result.updated.body.data).sort(), golden.update.dataKeys);
  assert.deepEqual(Object.keys(result.updated.body.data.product).sort(), golden.update.productKeys);
  assert.deepEqual(result.storedAfterUpdate, golden.storedAfterUpdate);
}

for (const platform of PLATFORMS) {
  test(`${platform}: POST/PUT /listings store and return exactly what the old route did`, async () => {
    const before = enqueued.length;
    const result = await createAndUpdate(platform, {
      createPath: "/listings", updatePath: (id) => `/listings/${id}`, extraBody: { platform },
    });
    assertMatchesGolden(platform, result);
    const queued = enqueued.slice(before).map(([p, type]) => `${p}:${type}`);
    assert.deepEqual(queued, platform === "google" ? ["google:sync_listing"] : [], "only Google pushes on create");
  });

  test(`${platform}: the old /${platform}/listings routes still answer identically`, async () => {
    const result = await createAndUpdate(platform, {
      createPath: `/${platform}/listings`, updatePath: (id) => `/${platform}/listings/${id}`,
    });
    assertMatchesGolden(platform, result);
  });
}

test("a repeated create returns the first listing, as before", async () => {
  const product = await makeProduct();
  const body = { platform: "ebay", ...GOLDEN.ebay.payloads.create, product: String(product._id) };
  const first = await call("POST", "/listings", body);
  const second = await call("POST", "/listings", body);
  assert.equal(second.status, 201);
  assert.equal(second.body.data._id, first.body.data._id);
});

test("eBay-only read/delete/push routes keep their eBay response shape", async () => {
  const product = await makeProduct();
  const created = await call("POST", "/ebay/listings", { ...GOLDEN.ebay.payloads.create, product: String(product._id) });
  const id = created.body.data._id;

  const one = await call("GET", `/ebay/listings/${id}`);
  assert.equal(one.status, 200);
  assert.ok("ebay_item_url" in one.body.data);
  const list = await call("GET", "/ebay/listings");
  assert.equal(list.status, 200);
  assert.ok(list.body.data.items.some((l) => l._id === id && "ebay_item_url" in l));
  // No images yet, so eBay's own pre-push check answers, as before.
  const pushed = await call("POST", `/ebay/listings/${id}/push`);
  assert.equal(pushed.status, 422);
  assert.equal(pushed.body.message, "Validation failed");
  assert.ok(pushed.body.errors.some((e) => e.field === "photo_overrides"));
  const removed = await call("DELETE", `/ebay/listings/${id}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.message, "Listing deleted");
});

test("an unknown or missing platform is rejected with the 400 shape", async () => {
  const product = await makeProduct();
  for (const platform of ["myspace", undefined, 42]) {
    const res = await call("POST", "/listings", { platform, product: String(product._id) });
    assert.equal(res.status, 400);
    assert.deepEqual({ ...res.body, message: undefined }, { status: "Fail", systemfailure: false, message: undefined, data: null });
    assert.match(res.body.message, /Unknown listing platform/);
  }
  assert.equal(await MarketplaceListing.countDocuments({ tenant_id: tenantId, product: product._id }), 0);
});

test("another tenant's product or variant is refused", async () => {
  const other = await makeTenantUser();
  const foreignProduct = await makeProduct(other.tenantId);
  for (const path of ["/listings", "/ebay/listings"]) {
    const res = await call("POST", path, { platform: "ebay", ...GOLDEN.ebay.payloads.create, product: String(foreignProduct._id) });
    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Product not found");
  }
  assert.equal(await MarketplaceListing.countDocuments({ product: foreignProduct._id }), 0);

  const mine = await makeProduct();
  const foreignVariant = await ProductVariant.create({ tenant_id: other.tenantId, product: foreignProduct._id, sku: `V-${crypto.randomUUID()}` });
  const res = await call("POST", "/listings", { platform: "google", product: String(mine._id), variant: String(foreignVariant._id) });
  assert.equal(res.status, 404);
  assert.equal(res.body.message, "Variant not found");
});

test("update resolves the stored platform; an alias can't touch another platform's listing", async () => {
  const product = await makeProduct();
  const created = await call("POST", "/listings", { platform: "google", ...GOLDEN.google.payloads.create, product: String(product._id) });
  const id = created.body.data._id;

  const viaGeneric = await call("PUT", `/listings/${id}`, { gtin: "999" });
  assert.equal(viaGeneric.status, 200);
  assert.equal(viaGeneric.body.data.gtin, "999");

  const viaWrongAlias = await call("PUT", `/ebay/listings/${id}`, GOLDEN.ebay.payloads.update);
  assert.equal(viaWrongAlias.status, 404);
  const stored = await MarketplaceListing.findById(id).lean();
  assert.equal(stored.title_override, null, "no eBay fields written onto the Google listing");

  assert.equal((await call("PUT", `/listings/${fixtureId()}`, { gtin: "1" })).status, 404);
  assert.equal((await call("PUT", "/listings/not-an-id", { gtin: "1" })).status, 400);
});
