// services/discount-pricing.service.test.js
// Pure pricing rules: derived status, per-type pricing and fixed allocation.

const test = require("node:test");
const assert = require("node:assert/strict");
const { discountStatus, priceDiscount, allocateFixed, orderAllows } = require("./discount-pricing.service");

const NOW = new Date("2026-10-18T00:00:00Z");
const DAY = 86_400_000;
const base = { active: true, starts_at: null, ends_at: null, usage_limit: null, usage_count: 0, minimum_order: 0 };
const all = () => true;
const lines = [
  { product: "a", unit_price: 10000, quantity: 2 },
  { product: "b", unit_price: 5000, quantity: 1 },
];

test("discountStatus follows paused > ended > exhausted > scheduled > live", () => {
  assert.equal(discountStatus({ ...base }, NOW), "live");
  assert.equal(discountStatus({ ...base, active: false }, NOW), "paused");
  assert.equal(discountStatus({ ...base, ends_at: new Date(NOW - DAY) }, NOW), "ended");
  assert.equal(discountStatus({ ...base, usage_limit: 5, usage_count: 5 }, NOW), "exhausted");
  assert.equal(discountStatus({ ...base, starts_at: new Date(+NOW + DAY) }, NOW), "scheduled");
});

test("percent discounts only eligible lines", () => {
  const d = { ...base, discount_type: "percent", discount_value: 10 };
  const priced = priceDiscount(d, { items: lines, shippingCents: 900, isEligible: (_, i) => i.product === "a" });
  assert.deepEqual(priced.lineDiscounts, [2000, 0]);
  assert.equal(priced.amount, 2000);
  assert.equal(priced.shippingCents, 900);
});

test("minimum order is checked against the whole cart subtotal", () => {
  const d = { ...base, discount_type: "fixed", discount_value: 10, minimum_order: 300 };
  assert.equal(priceDiscount(d, { items: lines, shippingCents: 0, isEligible: all }), null);
  const ok = priceDiscount({ ...d, minimum_order: 250 }, { items: lines, shippingCents: 0, isEligible: all });
  assert.equal(ok.amount, 1000);
});

test("free shipping needs every line eligible and shipping to waive", () => {
  const d = { ...base, discount_type: "free_shipping", discount_value: 0 };
  assert.equal(priceDiscount(d, { items: lines, shippingCents: 900, isEligible: (_, i) => i.product === "a" }), null);
  assert.equal(priceDiscount(d, { items: lines, shippingCents: 0, isEligible: all }), null);
  const priced = priceDiscount(d, { items: lines, shippingCents: 900, isEligible: all });
  assert.equal(priced.shippingCents, 0);
  assert.equal(priced.amount, 900);
});

test("allocateFixed sums exactly and caps at the eligible total", () => {
  assert.deepEqual(allocateFixed([3333, 3333, 3334], 1000), [333, 333, 334]);
  assert.deepEqual(allocateFixed([500, 0, 700], 5000), [500, 0, 700]);
  assert.deepEqual(allocateFixed([0, 0], 1500), [0, 0]);
});

test("orderAllows: open, first order, 2nd only, ranges, unknown email", () => {
  const range = (min, max) => ({ min_order_number: min, max_order_number: max });
  assert.equal(orderAllows(range(null, null), null), true);
  assert.equal(orderAllows(range(1, 1), null), false);
  assert.equal(orderAllows(range(1, 1), 0), true);
  assert.equal(orderAllows(range(1, 1), 1), false);
  assert.equal(orderAllows(range(2, 2), 1), true);
  assert.equal(orderAllows(range(2, 2), 2), false);
  assert.equal(orderAllows(range(2, null), 9), true);
  assert.equal(orderAllows(range(3, 5), 1), false);
  assert.equal(orderAllows(range(3, 5), 4), true);
  assert.equal(orderAllows(range(3, 5), 5), false);
  assert.equal(orderAllows(range(null, 3), 2), true);
});
