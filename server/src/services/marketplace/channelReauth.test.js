// services/marketplace/channelReauth.test.js
// A refused refresh token flags reauth, skips quietly, clears on reconnect.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
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
const Location = require("../../models/Location");
const Inventory = require("../../models/Inventory");
const Domain = require("../../models/Domain");
const { encrypt, packCiphertext } = require("../../utils/crypto/tokenCipher");
const { isInvalidGrant } = require("../../utils/http/oauthError");
const registry = require("./registry");

registry.register(require("./adapters/google.adapter"));
registry.register(require("./adapters/ebay.adapter"));

const { syncListing, syncBatch } = require("./sync.service");
const { reconcileTenantPrerequisites } = require("./channel-prerequisite.service");
const { diagnoseChannelConnection } = require("./connection-diagnosis.service");
const googleOauth = require("../google/google.oauth.service");
const ebaySettings = require("../ebay/ebay.settings.service");

const REAUTH = "reauthentication_required";
const INVALID_GRANT = { error: "invalid_grant", error_description: "Token has been expired or revoked." };

// getAccessToken's own credentials check reads these; dev .env sets them.
config.ebay.clientId ||= "test-client-id";
config.ebay.clientSecret ||= "test-client-secret";

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());
afterEach(() => mock.restoreAll());

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

// Token endpoints answer `tokenResponse`; everything else is recorded.
function stubFetch(tokenResponse, other = () => jsonResponse(404, { error: "unhandled" })) {
  const calls = { token: 0, other: 0 };
  mock.method(global, "fetch", async (url) => {
    if (/oauth2\.googleapis\.com\/token|identity\/v1\/oauth2\/token/.test(String(url))) {
      calls.token++;
      return tokenResponse();
    }
    calls.other++;
    return other(String(url));
  });
  return calls;
}

async function makeFixture(platform) {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const product = await Product.create({
    tenant_id: tenantId, title: `Reauth ${suffix}`, slug: `reauth-${suffix}`, sku: `RA-${suffix}`, status: "active", stock_control: true,
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 3 });
  const conn = {
    tenant_id: tenantId, platform, status: "connected", consecutive_failures: 0, status_reason: null,
    last_error: null, deleted_at: null, refresh_token_ct: packCiphertext(encrypt(`refresh-${suffix}`)),
  };
  if (platform === "google") {
    await Domain.create({
      tenant_id: tenantId, hostname: `store-${suffix}.example.com`, status: "active", is_default: true, verification_token: suffix,
    });
    // Expired access token, so the sync must refresh.
    Object.assign(conn, {
      access_token_ct: packCiphertext(encrypt("stale-access")), token_expires_at: new Date(Date.now() - 3600_000),
      merchant_id: "merchant123", data_source_id: "ds1", feed_label: "AU", content_language: "en", target_country: "AU",
    });
  }
  await ChannelConnection.collection.insertOne(conn);
  const listing = await MarketplaceListing.create({
    tenant_id: tenantId, product: product._id, platform, state: "active", condition: "new",
    ...(platform === "google"
      ? { feed_label: "AU", content_language: "en", external_listing_id: `en~AU~RA-${suffix}` }
      : { external_listing_id: `L-${suffix}`, external_offer_id: `O-${suffix}` }),
  });
  return { tenantId, listingId: String(listing._id) };
}

const connectionOf = (tenantId, platform) => ChannelConnection.collection.findOne({ tenant_id: tenantId, platform });
const failureRows = (tenantId) => ChannelSyncLog.countDocuments({ tenant_id: tenantId, status: "failure" });

async function assertFlagged(tenantId, platform, listingId, channelName) {
  const conn = await connectionOf(tenantId, platform);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, REAUTH);
  assert.match(conn.last_error, new RegExp(`Reconnect ${channelName}`));
  assert.equal(conn.consecutive_failures, 0, "a refused token never counts toward the breaker");
  assert.equal(await failureRows(tenantId), 0, "no per-listing failure rows");
  const listing = await MarketplaceListing.collection.findOne({ _id: new mongoose.Types.ObjectId(listingId) });
  assert.equal(listing.sync_status, "error");
  assert.match(listing.sync_error, /revoked or has expired/);
}

test("isInvalidGrant: only an invalid_grant body matches", () => {
  assert.equal(isInvalidGrant(JSON.stringify(INVALID_GRANT)), true);
  assert.equal(isInvalidGrant(JSON.stringify({ error: "invalid_request" })), false);
  assert.equal(isInvalidGrant("<html>Bad Request</html>"), false);
  assert.equal(isInvalidGrant(""), false);
});

test("google: invalid_grant on refresh flags reauth, skips without failure rows, and stops retrying", async () => {
  const { tenantId, listingId } = await makeFixture("google");
  const calls = stubFetch(() => jsonResponse(400, INVALID_GRANT));

  assert.deepEqual(await syncListing(listingId), { skipped: true, reason: REAUTH });
  await assertFlagged(tenantId, "google", listingId, "Google Shopping");
  assert.equal(calls.token, 1);

  // Sticky: later syncs never hit the token endpoint again.
  assert.deepEqual(await syncListing(listingId), { skipped: true, reason: REAUTH });
  assert.equal(calls.token, 1, "no retry against a refused token");
  assert.equal(calls.other, 0);
  await assertFlagged(tenantId, "google", listingId, "Google Shopping");
});

test("google: a domain change does not clear a reauth flag", async () => {
  const { tenantId, listingId } = await makeFixture("google");
  stubFetch(() => jsonResponse(400, INVALID_GRANT));
  await syncListing(listingId);

  assert.deepEqual(await reconcileTenantPrerequisites(tenantId), []);
  assert.equal((await connectionOf(tenantId, "google")).status_reason, REAUTH);
});

test("google: a fresh OAuth connect clears the flag and sync resumes", async () => {
  const { tenantId, listingId } = await makeFixture("google");
  stubFetch(() => jsonResponse(400, INVALID_GRANT));
  await syncListing(listingId);
  mock.restoreAll();

  stubFetch(
    () => jsonResponse(200, { access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }),
    (url) => (url.includes("dataSources")
      ? jsonResponse(200, { name: "accounts/merchant123/dataSources/ds2" })
      : jsonResponse(200, {})),
  );
  await googleOauth.savePendingConnection({ tenantId, code: "auth-code" });
  await googleOauth.completeConnection({
    tenantId, merchantId: "merchant123", feedLabel: "AU", contentLanguage: "en", targetCountry: "AU",
  });
  const conn = await connectionOf(tenantId, "google");
  assert.equal(conn.status, "connected");
  assert.equal(conn.status_reason, null);
  assert.equal(conn.last_error, null);

  // Fresh token: the next sync reaches the adapter instead of skipping.
  const calls = stubFetch(() => assert.fail("a fresh access token needs no refresh"));
  const result = await syncListing(listingId).catch((err) => err);
  assert.notDeepEqual(result, { skipped: true, reason: REAUTH });
  assert.equal(calls.token, 0);
  assert.equal((await connectionOf(tenantId, "google")).status_reason, null);
});

test("google: syncBatch on invalid_grant flags reauth and skips the batch", async () => {
  const { tenantId } = await makeFixture("google");
  stubFetch(() => jsonResponse(400, INVALID_GRANT));

  assert.deepEqual(await syncBatch("google", tenantId), { skipped: true, reason: REAUTH });
  const conn = await connectionOf(tenantId, "google");
  assert.equal(conn.status_reason, REAUTH);
  assert.equal(conn.consecutive_failures, 0);
  assert.equal(await failureRows(tenantId), 0);
});

test("google: an unrelated 400 on refresh is a normal failure, not reauth", async () => {
  const { tenantId, listingId } = await makeFixture("google");
  stubFetch(() => jsonResponse(400, { error: "invalid_request", error_description: "Missing parameter" }));

  await assert.rejects(syncListing(listingId), /token refresh failed: 400/);
  const conn = await connectionOf(tenantId, "google");
  assert.equal(conn.status, "connected");
  assert.equal(conn.status_reason, null);
  assert.equal(conn.consecutive_failures, 0, "a 400 still never counts");
  assert.equal(await failureRows(tenantId), 1, "the existing per-listing failure row");
});

test("ebay: invalid_grant on refresh flags reauth, skips without failure rows or a breaker count", async () => {
  const { tenantId, listingId } = await makeFixture("ebay");
  const calls = stubFetch(() => jsonResponse(400, { error: "invalid_grant", error_description: "refresh token is invalid" }));

  assert.deepEqual(await syncListing(listingId), { skipped: true, reason: REAUTH });
  await assertFlagged(tenantId, "ebay", listingId, "eBay");

  assert.deepEqual(await syncListing(listingId), { skipped: true, reason: REAUTH });
  assert.equal(calls.token, 1, "no retry against a refused token");
  assert.equal((await connectionOf(tenantId, "ebay")).consecutive_failures, 0);
});

test("ebay: a fresh OAuth connect clears the flag", async () => {
  const { tenantId, listingId } = await makeFixture("ebay");
  stubFetch(() => jsonResponse(400, INVALID_GRANT));
  await syncListing(listingId);

  // The same write oauthCallback makes after the code exchange.
  await ebaySettings.upsertSettings(tenantId, { refresh_token: "fresh-refresh-token" });
  const conn = await connectionOf(tenantId, "ebay");
  assert.equal(conn.status, "connected");
  assert.equal(conn.status_reason, null);
  assert.equal(conn.last_error, null);
});

test("ebay: an unrelated 400 keeps the existing 401 path and never flags reauth", async () => {
  const { tenantId, listingId } = await makeFixture("ebay");
  stubFetch(() => jsonResponse(400, { error: "invalid_scope" }));

  await assert.rejects(syncListing(listingId), /Could not obtain eBay access token/);
  const conn = await connectionOf(tenantId, "ebay");
  assert.equal(conn.status_reason, null);
  assert.equal(conn.status, "connected");
  assert.equal(conn.consecutive_failures, 1, "unchanged: a null token is still a counted 401");
});

test("diagnosis: a flagged connection reads as reauth, not as a prerequisite", async () => {
  const { tenantId, listingId } = await makeFixture("google");
  stubFetch(() => jsonResponse(400, INVALID_GRANT));
  await syncListing(listingId);
  mock.restoreAll();

  const d = await diagnoseChannelConnection(tenantId, "google");
  assert.equal(d.prerequisite.reason, REAUTH);
  assert.match(d.summary, /status_reason=reauthentication_required/);
  assert.match(d.summary, /reconnect \(OAuth\) clears it/);
  assert.doesNotMatch(d.summary, /configuration problem/);
});
