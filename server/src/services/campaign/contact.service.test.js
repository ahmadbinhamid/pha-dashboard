// services/campaign/contact.service.test.js
// Consent rules: unsubscribes stick, bounces stop sends, signups resubscribe.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const Contact = require("../../models/Contact");
const contactService = require("./contact.service");

const TENANT = fixtureId();
const statusOf = async (email) => (await Contact.findOne({ tenant_id: TENANT, email }).lean())?.status;

test.before(() => mongoose.connect(config.mongoUri));
test.after(() => mongoose.disconnect());

test("import creates, then updates without duplicating", async () => {
  const rows = [{ email: "a@example.com", first_name: "Ann", lists: ["VIP"] }, { email: "b@example.com" }];
  const first = await contactService.importContacts(TENANT, rows, { lists: ["Trade show"] });
  assert.deepEqual(first, { created: 2, updated: 0, unsubscribed: 0 });
  const second = await contactService.importContacts(TENANT, rows);
  assert.deepEqual(second, { created: 0, updated: 2, unsubscribed: 0 });
  const ann = await Contact.findOne({ tenant_id: TENANT, email: "a@example.com" }).lean();
  assert.deepEqual(ann.lists.sort(), ["Trade show", "VIP"]);
});

test("an unsubscribe survives re-importing the same address", async () => {
  await contactService.importContacts(TENANT, [{ email: "gone@example.com" }]);
  const { unsubscribe_token: token } = await Contact.findOne({ tenant_id: TENANT, email: "gone@example.com" }).lean();
  assert.equal((await contactService.unsubscribeByToken(token)).email, "gone@example.com");
  const reimport = await contactService.importContacts(TENANT, [{ email: "gone@example.com", first_name: "Back" }]);
  assert.equal(reimport.unsubscribed, 1);
  assert.equal(await statusOf("gone@example.com"), "unsubscribed");
  assert.equal(await contactService.unsubscribeByToken("f".repeat(48)), null);
});

test("unsubscribed and bounced contacts leave the audience", async () => {
  await contactService.importContacts(TENANT, [{ email: "live@example.com" }, { email: "dead@example.com" }]);
  const dead = await Contact.findOne({ tenant_id: TENANT, email: "dead@example.com" }).lean();
  await contactService.markContactBounced(dead._id, "550 5.1.1 no such user");
  assert.equal(await statusOf("dead@example.com"), "bounced");
  const ids = [];
  for await (const { _id } of contactService.cursorAudienceIds(TENANT, { type: "all" })) ids.push(String(_id));
  assert.ok(!ids.includes(String(dead._id)));
  assert.ok(ids.length >= 1);
});

test("a bounce never overrides an unsubscribe", async () => {
  await contactService.importContacts(TENANT, [{ email: "both@example.com" }]);
  const c = await Contact.findOne({ tenant_id: TENANT, email: "both@example.com" }).lean();
  await contactService.unsubscribeByToken(c.unsubscribe_token);
  await contactService.markContactBounced(c._id, "550 5.1.1");
  assert.equal(await statusOf("both@example.com"), "unsubscribed");
});

test("their own website signup resubscribes and clears a bounce", async () => {
  await contactService.importContacts(TENANT, [{ email: "returning@example.com" }]);
  const c = await Contact.findOne({ tenant_id: TENANT, email: "returning@example.com" }).lean();
  await contactService.markContactBounced(c._id, "550 5.1.1");
  const { created } = await contactService.subscribeFromNewsletter(TENANT, { email: "returning@example.com", lists: ["Website popup"] });
  assert.equal(created, false);
  const after = await Contact.findOne({ _id: c._id }).lean();
  assert.equal(after.status, "subscribed");
  assert.equal(after.bounce_reason, null);
  assert.ok(after.lists.includes("Website popup"));
});

test("staff can unsubscribe someone but never resubscribe them", async () => {
  await contactService.importContacts(TENANT, [{ email: "staff@example.com" }]);
  const c = await Contact.findOne({ tenant_id: TENANT, email: "staff@example.com" }).lean();
  await contactService.updateContact(c._id, TENANT, { status: "unsubscribed" });
  assert.equal(await statusOf("staff@example.com"), "unsubscribed");
  await contactService.updateContact(c._id, TENANT, { first_name: "Still" });
  assert.equal(await statusOf("staff@example.com"), "unsubscribed");
});
