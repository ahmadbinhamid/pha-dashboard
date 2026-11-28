// services/discount-code.service.test.js
// Per-email signup codes: one per email, email-locked, single use. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
const DiscountCode = require("../models/DiscountCode");
const codeService = require("./discount-code.service");
const { createDiscount } = require("./discount.service");
const { resolveCheckoutDiscount, reserveRedemption } = require("./discount-pricing.service");

const TENANT = fixtureId();
const CART = [{ product: new mongoose.Types.ObjectId(), unit_price: 10000, quantity: 1 }];

async function makeOffer(overrides = {}) {
  return createDiscount(TENANT, {
    name: "Signup offer",
    unique_codes: true,
    code_prefix: "TEST",
    code_valid_days: 30,
    discount_type: "percent",
    discount_value: 15,
    minimum_order: 0,
    scope: "storewide",
    active: true,
    ...overrides,
  });
}

const checkout = (code, customerEmail) => resolveCheckoutDiscount(TENANT, { code, items: CART, shippingCents: 0, customerEmail });

test.before(() => mongoose.connect(config.mongoUri));
test.after(() => mongoose.disconnect());

test("one code per email, and signing up again returns the same one", async () => {
  const offer = await makeOffer();
  const a1 = await codeService.issueCodeForEmail(TENANT, offer, "A@Example.com");
  const a2 = await codeService.issueCodeForEmail(TENANT, offer, "a@example.com");
  const b = await codeService.issueCodeForEmail(TENANT, offer, "b@example.com");
  assert.match(a1.code, /^TEST-[A-Z2-9]{6}$/);
  assert.equal(a1.created, true);
  assert.equal(a2.code, a1.code);
  assert.equal(a2.created, undefined);
  assert.notEqual(b.code, a1.code);
});

test("simultaneous signups for one email share a single code", async () => {
  const offer = await makeOffer();
  const results = await Promise.all(Array.from({ length: 5 }, () => codeService.issueCodeForEmail(TENANT, offer, "race@example.com")));
  assert.equal(new Set(results.map((r) => r.code)).size, 1);
  assert.equal(await DiscountCode.countDocuments({ discount_id: offer._id }), 1);
});

test("the code only works with the email it was issued to", async () => {
  const offer = await makeOffer();
  const { code } = await codeService.issueCodeForEmail(TENANT, offer, "owner@example.com");
  await assert.rejects(checkout(code, undefined), /Enter the email you signed up with/);
  await assert.rejects(checkout(code, "someone.else@example.com"), /different email/);
  const ok = await checkout(code.toLowerCase(), "OWNER@example.com");
  assert.equal(ok.discount.code, code);
  assert.equal(ok.amount, 1500);
});

test("an expired code is refused at checkout", async () => {
  const offer = await makeOffer();
  const { code } = await codeService.issueCodeForEmail(TENANT, offer, "late@example.com");
  await DiscountCode.updateOne({ code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  await assert.rejects(checkout(code, "late@example.com"), /expired/);
});

test("used once: parallel orders admit exactly one, then it's refused", async () => {
  const offer = await makeOffer();
  const email = "once@example.com";
  const { code } = await codeService.issueCodeForEmail(TENANT, offer, email);
  const { discount } = await checkout(code, email);
  const reservation = { tenantId: TENANT, customerEmail: email, amount: 1500, orderTotal: 8500 };
  const settled = await Promise.allSettled(Array.from({ length: 5 }, () => reserveRedemption(discount, reservation)));
  assert.equal(settled.filter((s) => s.status === "fulfilled").length, 1);
  await assert.rejects(checkout(code, email), /already been used/);
  const again = await codeService.issueCodeForEmail(TENANT, offer, email);
  assert.equal(again.used, true);
});

test("a paused offer stops its codes working", async () => {
  const offer = await makeOffer();
  const { code } = await codeService.issueCodeForEmail(TENANT, offer, "paused@example.com");
  await mongoose.model("Discount").updateOne({ _id: offer._id }, { $set: { active: false } });
  await assert.rejects(checkout(code, "paused@example.com"), /not valid or has expired/);
});
