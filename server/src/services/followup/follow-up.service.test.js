// services/followup/follow-up.service.test.js
// Who gets a follow-up and when, once only; ratings and alerts. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");

// Stub the queue before the service binds it, so nothing is really emailed.
const queued = [];
require("../../queues/campaign.queue").enqueueFollowUpSends = async (ids) => queued.push(...ids.map(String));

const Order = require("../../models/Order");
const FollowUp = require("../../models/FollowUp");
const FollowUpSend = require("../../models/FollowUpSend");
const Contact = require("../../models/Contact");
const { sweepFollowUp } = require("./follow-up.service");
const feedbackService = require("./feedback.service");

const TENANT = fixtureId();
const DAY = 86_400_000;
const NOW = new Date();
const ago = (days) => new Date(NOW - days * DAY);

async function order({ email, method = "delivery", channel = "storefront", fulfilledDaysAgo, status = "paid" }) {
  const suffix = crypto.randomUUID();
  const doc = await Order.create({
    tenant_id: TENANT,
    order_number: `TEST-FU-${suffix}`,
    invoice_number: `TEST-FU-INV-${suffix}`,
    items: [
      { product: fixtureId(), name: "Brake pads", unit_price: 5000, quantity: 1 },
      { product: fixtureId(), name: "Rotor", unit_price: 9000, quantity: 2 },
    ],
    customer: { name: "Test Buyer", email, phone: null },
    delivery_method: method,
    ...(method === "delivery" && { shipping_address: { address: "1 Test St", suburb: "Testville", state: "NSW", postcode: "2000" } }),
    subtotal: 23000,
    shipping_cost: 0,
    tax_amount: 2091,
    total: 23000,
    currency: "aud",
    channel,
    status,
    payment_status: "paid",
    fulfillment_status: "completed",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  await Order.updateOne({ _id: doc._id }, { $set: { fulfilled_at: ago(fulfilledDaysAgo) } });
  return doc;
}

async function followUp(overrides = {}) {
  return (
    await FollowUp.create({
      tenant_id: TENANT,
      name: "Feedback",
      subject: "How was it?",
      shipped_delay_days: 7,
      handover_delay_days: 5,
      enabled: true,
      enabled_at: ago(30),
      alert_at_or_below: 2,
      ...overrides,
    })
  ).toObject();
}

test.before(() => mongoose.connect(config.mongoUri));
test.after(() => mongoose.disconnect());

test("completing an order stamps fulfilled_at; reopening clears it", async () => {
  const o = await order({ email: "stamp@example.com", fulfilledDaysAgo: 0 });
  const fresh = await Order.findById(o._id);
  fresh.fulfillment_status = "pending";
  await fresh.save();
  assert.equal(fresh.fulfilled_at, null);
  fresh.fulfillment_status = "completed";
  await fresh.save();
  assert.ok(Date.now() - fresh.fulfilled_at < 5000);
});

test("only due, eligible orders are emailed, and only once", async () => {
  const f = await followUp();
  const due = [
    await order({ email: "shipped8@example.com", method: "delivery", fulfilledDaysAgo: 8 }),
    await order({ email: "pickup6@example.com", method: "pickup", fulfilledDaysAgo: 6 }),
    await order({ email: "counter6@example.com", method: "pickup", channel: "manual", fulfilledDaysAgo: 6 }),
  ];
  const notDue = [
    await order({ email: "shipped3@example.com", method: "delivery", fulfilledDaysAgo: 3 }),
    await order({ email: "ebay@example.com", channel: "ebay", fulfilledDaysAgo: 8 }),
    await order({ email: "refunded@example.com", status: "refunded", fulfilledDaysAgo: 8 }),
    await order({ email: null, fulfilledDaysAgo: 8 }),
    await order({ email: "ancient@example.com", fulfilledDaysAgo: 60 }),
  ];
  queued.length = 0;
  assert.equal(await sweepFollowUp(f, NOW), due.length);
  const sends = await FollowUpSend.find({ follow_up_id: f._id }).lean();
  assert.deepEqual(sends.map((s) => String(s.order_id)).sort(), due.map((o) => String(o._id)).sort());
  assert.ok(notDue.every((o) => !sends.some((s) => String(s.order_id) === String(o._id))));
  assert.equal(await sweepFollowUp(f, NOW), 0);
  assert.equal(await FollowUpSend.countDocuments({ follow_up_id: f._id }), due.length);
});

test("orders completed before switching on are never emailed", async () => {
  const f = await followUp({ enabled_at: ago(2) });
  await order({ email: "before@example.com", method: "pickup", fulfilledDaysAgo: 6 });
  assert.equal(await sweepFollowUp(f, NOW), 0);
});

test("unsubscribed customers are recorded as skipped, not emailed", async () => {
  const f = await followUp();
  await Contact.create({ tenant_id: TENANT, email: "nope@example.com", source: "customer", status: "unsubscribed" });
  const o = await order({ email: "nope@example.com", method: "pickup", fulfilledDaysAgo: 6 });
  queued.length = 0;
  await sweepFollowUp(f, NOW);
  const send = await FollowUpSend.findOne({ follow_up_id: f._id, order_id: o._id }).lean();
  assert.equal(send.status, "skipped");
  assert.ok(!queued.includes(String(send._id)));
});

test("ratings save per product, update on resubmit and alert once", async () => {
  const f = await followUp();
  const o = await order({ email: "rater@example.com", method: "pickup", fulfilledDaysAgo: 6 });
  await sweepFollowUp(f, NOW);
  const { token } = await FollowUpSend.findOne({ follow_up_id: f._id, order_id: o._id }).lean();
  const form = await feedbackService.getFeedbackForm(token);
  assert.equal(form.items.length, 2);
  const [pads] = form.items;
  await feedbackService.submitFeedback(token, [{ item_id: pads.item_id, rating: 1, comment: "Squeals" }]);
  await feedbackService.submitFeedback(token, [{ item_id: pads.item_id, rating: 2 }]);
  const { items } = await feedbackService.listFeedback(TENANT, { search: "rater@example.com" });
  assert.equal(items.length, 1);
  assert.equal(items[0].rating, 2);
  assert.equal(items[0].comment, "Squeals");
  assert.ok(items[0].alerted_at);
  await assert.rejects(feedbackService.submitFeedback(token, [{ item_id: String(fixtureId()), rating: 5 }]), /isn't part of this order/);
  await assert.rejects(feedbackService.getFeedbackForm("0".repeat(48)), /isn't valid/);
});

test("the opt-out link unsubscribes the customer from everything", async () => {
  const f = await followUp();
  const o = await order({ email: "optout@example.com", method: "pickup", fulfilledDaysAgo: 6 });
  await sweepFollowUp(f, NOW);
  const { token } = await FollowUpSend.findOne({ follow_up_id: f._id, order_id: o._id }).lean();
  await feedbackService.optOutByToken(token);
  const contact = await Contact.findOne({ tenant_id: TENANT, email: "optout@example.com" }).lean();
  assert.equal(contact.status, "unsubscribed");
});
