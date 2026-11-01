// services/stripe/stripe.keys.service.retarget.test.js
// Moves only this store's own webhook to a new domain, keeping the endpoint.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");
const { trackFixtureTenant } = require("../../testUtils/fixtureTenants");
const Tenant = require("../../models/Tenant");
const { encrypt } = require("../../utils/crypto/tokenCipher");
const { retargetWebhookEndpoints, buildWebhookUrl } = require("./stripe.keys.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const NEW_BASE = "https://app.partsmanager.com.au";

async function stripeTenant() {
  const suffix = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("hex");
  const { ciphertext, iv, tag } = encrypt("sk_test_fixture");
  const tenant = trackFixtureTenant(
    await Tenant.create({
      name: `Stripe retarget ${suffix}`, slug: `stripe-retarget-${suffix}`, code: `SRT${suffix.slice(0, 6).toUpperCase()}`,
      stripe_webhook_token: token,
      stripe_secret_key_ciphertext: ciphertext, stripe_secret_key_iv: iv, stripe_secret_key_tag: tag,
    }),
  );
  return { tenant, token };
}

// In-memory stand-in for the Stripe SDK's webhookEndpoints resource.
function fakeStripe(endpoints) {
  const updates = [];
  return {
    updates,
    client: {
      webhookEndpoints: {
        list: () => ({ autoPagingToArray: async () => endpoints }),
        update: async (id, { url }) => {
          updates.push({ id, url });
          return { id, url };
        },
      },
    },
  };
}

test("dry run reports, confirm updates only this store's endpoint", async () => {
  const { tenant, token } = await stripeTenant();
  const fake = fakeStripe([
    { id: "we_ours", url: `https://app.autopartspro.au/api/v1/payment/webhook?wt=${token}` },
    { id: "we_other_app", url: "https://zapier.example.com/hook" },
    { id: "we_other_store", url: "https://app.autopartspro.au/api/v1/payment/webhook?wt=someone-else" },
  ]);
  const run = (dryRun) =>
    retargetWebhookEndpoints({ baseUrl: NEW_BASE, dryRun, tenantId: tenant._id, clientFor: () => fake.client });

  assert.deepEqual(await run(true), { would_update: 1 });
  assert.equal(fake.updates.length, 0, "dry run never calls Stripe update");

  assert.deepEqual(await run(false), { updated: 1 });
  assert.deepEqual(fake.updates, [{ id: "we_ours", url: buildWebhookUrl(NEW_BASE, token) }]);
});

test("current, missing and failing stores are reported, not thrown", async () => {
  const { tenant, token } = await stripeTenant();
  const current = fakeStripe([{ id: "we_ours", url: buildWebhookUrl(NEW_BASE, token) }]);
  assert.deepEqual(
    await retargetWebhookEndpoints({ baseUrl: NEW_BASE, dryRun: false, tenantId: tenant._id, clientFor: () => current.client }),
    { already_current: 1 },
  );
  assert.deepEqual(
    await retargetWebhookEndpoints({ baseUrl: NEW_BASE, tenantId: tenant._id, clientFor: () => fakeStripe([]).client }),
    { no_endpoint: 1 },
  );
  const failing = { webhookEndpoints: { list: () => ({ autoPagingToArray: async () => { throw new Error("restricted key"); } }) } };
  assert.deepEqual(
    await retargetWebhookEndpoints({ baseUrl: NEW_BASE, tenantId: tenant._id, clientFor: () => failing }),
    { error: 1 },
  );
});
