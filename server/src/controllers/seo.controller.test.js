// controllers/seo.controller.test.js
// Going live needs seo.publish; plain edits and unchanged dates don't.

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertCanPublish } = require("./seo.controller");

const asMember = (permissions) => ({
  tenantId: "t1",
  user: { role: "user" },
  membership: { status: "active", role_id: { name: "Marketing", permissions } },
});
const writer = asMember(["seo.view", "seo.create", "seo.update"]);
const publisher = asMember(["seo.view", "seo.update", "seo.publish"]);
const live = { status: "published", published_at: new Date("2026-11-01T00:00:00Z") };

test("a writer can save drafts and edit live content in place", () => {
  assert.doesNotThrow(() => assertCanPublish(writer, { title: "New", status: "draft" }));
  assert.doesNotThrow(() => assertCanPublish(writer, { title: "Fix typo", status: "published" }, live));
  // The form resends the saved date as an ISO string; that's no change.
  assert.doesNotThrow(() => assertCanPublish(writer, { published_at: "2026-11-01T00:00:00.000Z" }, live));
});

test("a writer can't publish, unpublish or re-date", () => {
  assert.throws(() => assertCanPublish(writer, { status: "published" }), /permission to publish/);
  assert.throws(() => assertCanPublish(writer, { status: "draft" }, live), /permission to publish/);
  assert.throws(() => assertCanPublish(writer, { published_at: "2030-01-01T00:00:00.000Z" }, live), /permission to publish/);
});

test("someone with seo.publish, or the owner, can", () => {
  assert.doesNotThrow(() => assertCanPublish(publisher, { status: "published" }));
  const owner = { tenantId: "t1", user: { role: "user" }, membership: { status: "active", role_id: { name: "Admin", permissions: [] } } };
  assert.doesNotThrow(() => assertCanPublish(owner, { status: "draft" }, live));
});
