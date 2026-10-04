// middlewares/auth.removedAccess.test.js
// Removed or suspended staff get no tenant via User.tenant_id. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Attachment = require("../models/Attachment");
const { seedSystemRoles } = require("../services/role.service");
const membershipService = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

let baseUrl;
let server;

before(async () => {
  await mongoose.connect(config.mongoUri);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
});

async function makeTenant() {
  const tenantId = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenantId, name: `Auth ${suffix}`, slug: `auth-${suffix}`, code: `AU${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(tenantId);
  return { tenantId, roles };
}

// Mirrors an invited user: User.tenant_id is the inviting tenant.
async function makeUser(tenantId, role = "user") {
  const { insertedId } = await User.collection.insertOne({
    tenant_id: tenantId, first_name: "Test", last_name: "User", email: `auth-${crypto.randomUUID()}@example.com`,
    password: "x".repeat(20), role, status: "active", deleted_at: null, created_at: new Date(),
  });
  return { userId: insertedId, token: signJwt({ sub: String(insertedId), role }) };
}

async function addAttachment(tenantId) {
  const doc = await Attachment.create({ tenant_id: tenantId, uid: crypto.randomUUID(), file_name: null, type: "image" });
  return String(doc._id);
}

const call = (token, method, path, opts = {}) =>
  fetch(`${baseUrl}${path}`, { method, ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });

async function statusOf(res) {
  await res.arrayBuffer();
  return res.status;
}

function uploadBody() {
  const form = new FormData();
  form.append("files", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])], { type: "image/jpeg" }), "photo.jpg");
  return form;
}

// Every tenantMember route the audit named, from one user's point of view.
async function tenantRouteStatuses(token, attachmentId) {
  return {
    list: await statusOf(await call(token, "GET", "/attachment")),
    upload: await statusOf(await call(token, "POST", "/attachment", { body: uploadBody() })),
    remove: await statusOf(await call(token, "DELETE", `/attachment/${attachmentId}`)),
    settings: await statusOf(await call(token, "GET", "/tenant-settings")),
  };
}

const ALL_FORBIDDEN = { list: 403, upload: 403, remove: 403, settings: 403 };

test("a removed member gets 403 on attachments and tenant settings", async () => {
  const { tenantId, roles } = await makeTenant();
  const { userId, token } = await makeUser(tenantId);
  await membershipService.addMember({ tenantId, userId, roleId: roles[SYSTEM_ROLE.STAFF]._id });
  await membershipService.removeMember(userId, tenantId);
  const attachmentId = await addAttachment(tenantId);

  assert.deepEqual(await tenantRouteStatuses(token, attachmentId), ALL_FORBIDDEN);
  assert.ok(await Attachment.exists({ _id: attachmentId }), "the attachment survives");
});

test("a suspended member gets 403 on attachments and tenant settings", async () => {
  const { tenantId, roles } = await makeTenant();
  const { userId, token } = await makeUser(tenantId);
  await membershipService.addMember({ tenantId, userId, roleId: roles[SYSTEM_ROLE.STAFF]._id });
  await membershipService.updateMember(userId, tenantId, { status: "suspended" });
  const attachmentId = await addAttachment(tenantId);

  assert.deepEqual(await tenantRouteStatuses(token, attachmentId), ALL_FORBIDDEN);
  assert.ok(await Attachment.exists({ _id: attachmentId }));
});

test("a removed user's access state reports no organisation", async () => {
  const { tenantId, roles } = await makeTenant();
  const { userId, token } = await makeUser(tenantId, "admin");
  await membershipService.addMember({ tenantId, userId, roleId: roles[SYSTEM_ROLE.STAFF]._id });
  await membershipService.removeMember(userId, tenantId);

  const res = await call(token, "GET", "/members/me/access");
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, { has_organisation: false, is_tenant_admin: false, role: null, permissions: [] });
});

test("a member of two tenants removed from one keeps the other, and only it", async () => {
  const home = await makeTenant();
  const other = await makeTenant();
  const { userId, token } = await makeUser(home.tenantId);
  await membershipService.addMember({ tenantId: home.tenantId, userId, roleId: home.roles[SYSTEM_ROLE.STAFF]._id });
  await membershipService.addMember({ tenantId: other.tenantId, userId, roleId: other.roles[SYSTEM_ROLE.STAFF]._id });
  await membershipService.removeMember(userId, home.tenantId);
  const homeAttachment = await addAttachment(home.tenantId);
  const otherAttachment = await addAttachment(other.tenantId);

  const list = await call(token, "GET", "/attachment");
  assert.equal(list.status, 200);
  const ids = (await list.json()).data.items.map((a) => a._id);
  assert.deepEqual(ids, [otherAttachment], "sees only the remaining tenant's files");

  assert.equal(await statusOf(await call(token, "DELETE", `/attachment/${homeAttachment}`)), 404);
  assert.ok(await Attachment.exists({ _id: homeAttachment }));
  assert.equal(await statusOf(await call(token, "GET", "/attachment", { headers: { "x-tenant-id": String(home.tenantId) } })), 403);
});

test("an active member is unaffected", async () => {
  const { tenantId, roles } = await makeTenant();
  const { userId, token } = await makeUser(tenantId);
  await membershipService.addMember({ tenantId, userId, roleId: roles[SYSTEM_ROLE.STAFF]._id });
  const attachmentId = await addAttachment(tenantId);

  const statuses = await tenantRouteStatuses(token, attachmentId);
  assert.equal(statuses.list, 200);
  assert.equal(statuses.upload, 201);
  assert.equal(statuses.remove, 200);
  assert.equal(statuses.settings, 200);

  // Uploaded files are real; clean them off disk.
  const uploaded = await Attachment.find({ tenant_id: tenantId, file_name: { $ne: null } }).lean();
  for (const doc of uploaded) {
    await call(token, "DELETE", `/attachment/${doc._id}`).then(statusOf);
  }
});

test("a superadmin route still works without a membership, scoped to its own tenant", async () => {
  const { tenantId } = await makeTenant();
  const { token } = await makeUser(tenantId, "superadmin");
  const target = await makeUser(tenantId);
  const targetEmail = (await User.findById(target.userId).lean()).email;

  const res = await call(token, "POST", "/auth/verify-account", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: targetEmail, status: "inactive" }),
  });
  assert.equal(res.status, 200, await res.clone().text());
  await res.arrayBuffer();
  assert.equal((await User.findById(target.userId).lean()).status, "inactive");

  // Another tenant's user is still out of scope.
  const elsewhere = await makeTenant();
  const stranger = await makeUser(elsewhere.tenantId);
  const strangerEmail = (await User.findById(stranger.userId).lean()).email;
  const denied = await call(token, "POST", "/auth/verify-account", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: strangerEmail, status: "inactive" }),
  });
  assert.equal(await statusOf(denied), 401);
  assert.equal((await User.findById(stranger.userId).lean()).status, "active");
});
