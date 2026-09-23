// middlewares/auth.membership.test.js
// How a request picks its organisation: X-Tenant-Id only selects between organisations the
// caller already belongs to, never grants access to one they don't.
// Needs a live Mongo connection. Run: node --test src/middlewares/auth.membership.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Role = require("../models/Role");
const Membership = require("../models/Membership");
const roleService = require("../services/role.service");
const membershipService = require("../services/membership.service");
const { SYSTEM_ROLE, MEMBERSHIP_STATUS } = require("../constants/access.constants");
const { signJwt } = require("../utils/auth/jwt");
const { auth, requirePermission } = require("./auth");

/** Minimal Express doubles, enough to see which branch the middleware took. */
function makeReq(token, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { authorization: `Bearer ${token}`, ...lower },
    header: (name) => lower[name.toLowerCase()],
  };
}
function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}
async function runMiddleware(mw, req, res) {
  let nextCalled = false;
  let nextErr = null;
  await mw(req, res, (err) => {
    nextCalled = true;
    nextErr = err ?? null;
  });
  return { nextCalled, nextErr };
}

test("auth: resolves the default organisation, and X-Tenant-Id switches between the caller's own", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);

  const orgA = await Tenant.create({ name: `Auth A ${suffix}`, slug: `auth-a-${suffix}`, code: `AA${suffix.slice(0, 6)}`, company_name: `Auth A ${suffix}` });
  const orgB = await Tenant.create({ name: `Auth B ${suffix}`, slug: `auth-b-${suffix}`, code: `AB${suffix.slice(0, 6)}`, company_name: `Auth B ${suffix}` });
  const outsider = await Tenant.create({ name: `Auth X ${suffix}`, slug: `auth-x-${suffix}`, code: `AX${suffix.slice(0, 6)}`, company_name: `Auth X ${suffix}` });

  const user = await User.create({
    tenant_id: orgA._id,
    first_name: "Auth",
    last_name: "Test",
    email: `auth-${suffix}@example.test`,
    password: "password123",
    role: "user",
    status: "active",
  });
  const token = signJwt({ sub: String(user._id), role: "user" });

  try {
    const rolesA = await roleService.seedSystemRoles(orgA._id);
    const rolesB = await roleService.seedSystemRoles(orgB._id);
    await roleService.seedSystemRoles(outsider._id);
    await membershipService.addMember({ tenantId: orgA._id, userId: user._id, roleId: rolesA[SYSTEM_ROLE.ADMIN]._id });
    await membershipService.addMember({ tenantId: orgB._id, userId: user._id, roleId: rolesB[SYSTEM_ROLE.STAFF]._id });

    // No header → the default organisation (the first one joined).
    let req = makeReq(token);
    let res = makeRes();
    let out = await runMiddleware(auth(), req, res);
    assert.equal(out.nextCalled, true, "authenticated");
    assert.equal(String(req.tenantId), String(orgA._id), "defaults to the first organisation joined");
    assert.ok(req.permissions.includes("settings.update"), "carries the Admin permissions of that org");

    // Header → that organisation, with the role held THERE.
    req = makeReq(token, { "X-Tenant-Id": String(orgB._id) });
    res = makeRes();
    out = await runMiddleware(auth(), req, res);
    assert.equal(out.nextCalled, true);
    assert.equal(String(req.tenantId), String(orgB._id), "switches organisation");
    assert.ok(!req.permissions.includes("settings.update"), "and switches to the Staff permissions held there");

    // Header naming an organisation they don't belong to → refused.
    req = makeReq(token, { "X-Tenant-Id": String(outsider._id) });
    res = makeRes();
    out = await runMiddleware(auth(), req, res);
    assert.equal(out.nextCalled, false, "does not continue");
    assert.equal(res.statusCode, 403, "forbidden");

    // A suspended membership can't be used at all.
    await membershipService.updateMember(user._id, orgB._id, { status: MEMBERSHIP_STATUS.SUSPENDED });
    req = makeReq(token, { "X-Tenant-Id": String(orgB._id) });
    res = makeRes();
    out = await runMiddleware(auth(), req, res);
    assert.equal(out.nextCalled, false, "suspended membership is not selectable");
    assert.equal(res.statusCode, 403);
  } finally {
    await Membership.deleteMany({ user_id: user._id });
    await Role.deleteMany({ tenant_id: { $in: [orgA._id, orgB._id, outsider._id] } });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteMany({ _id: { $in: [orgA._id, orgB._id, outsider._id] } });
    await mongoose.disconnect();
  }
});

test("requirePermission: gates on the role held in the ACTIVE organisation", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);

  const org = await Tenant.create({ name: `Perm ${suffix}`, slug: `perm-${suffix}`, code: `PM${suffix.slice(0, 6)}`, company_name: `Perm ${suffix}` });
  const user = await User.create({
    tenant_id: org._id,
    first_name: "Perm",
    last_name: "Test",
    email: `perm-${suffix}@example.test`,
    password: "password123",
    role: "user",
    status: "active",
  });
  const token = signJwt({ sub: String(user._id), role: "user" });

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    await membershipService.addMember({ tenantId: org._id, userId: user._id, roleId: roles[SYSTEM_ROLE.STAFF]._id });

    const req = makeReq(token);
    const res = makeRes();
    await runMiddleware(auth(), req, res);

    // Staff sells but doesn't manage the team.
    let out = await runMiddleware(requirePermission("orders.create"), req, makeRes());
    assert.equal(out.nextCalled, true, "granted what the role holds");

    const denied = makeRes();
    out = await runMiddleware(requirePermission("users.create"), req, denied);
    assert.equal(out.nextCalled, false, "refused what it doesn't");
    assert.equal(denied.statusCode, 403);

    // Promote, and the same request-level check now passes.
    await membershipService.updateMember(user._id, org._id, { roleId: roles[SYSTEM_ROLE.ADMIN]._id });
    out = await runMiddleware(requirePermission("users.create"), req, makeRes());
    assert.equal(out.nextCalled, true, "a role change takes effect without re-issuing the token");
  } finally {
    await Membership.deleteMany({ user_id: user._id });
    await Role.deleteMany({ tenant_id: org._id });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteOne({ _id: org._id });
    await mongoose.disconnect();
  }
});
