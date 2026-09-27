// middlewares/auth.tenant.test.js
// tenantMember admits any member; tenantAdmin only the Admin. No Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const { tenantMember, tenantAdmin } = require("./auth");

function run(middleware, req) {
  let status = null;
  let nexted = false;
  const res = { status: (code) => ((status = code), res), json: () => res };
  middleware(req, res, () => (nexted = true));
  return { status, nexted };
}

const member = (roleName) => ({ user: { role: "user" }, tenantId: "t1", membership: { role_id: { name: roleName } } });

test("tenantMember: any member passes; no tenant (platform superadmin) is refused", () => {
  assert.equal(run(tenantMember, member("Staff")).nexted, true);
  assert.equal(run(tenantMember, { user: { role: "superadmin" }, tenantId: null }).status, 403);
  assert.equal(run(tenantMember, {}).status, 401);
});

test("tenantAdmin: Admin (and pre-migration Super Admin) pass; Staff is refused", () => {
  assert.equal(run(tenantAdmin, member("Admin")).nexted, true);
  assert.equal(run(tenantAdmin, member("Super Admin")).nexted, true);
  assert.equal(run(tenantAdmin, member("Staff")).status, 403);
  // Pre-membership accounts fall back to the legacy account role.
  assert.equal(run(tenantAdmin, { user: { role: "admin" }, tenantId: "t1" }).nexted, true);
  assert.equal(run(tenantAdmin, { user: { role: "user" }, tenantId: "t1" }).status, 403);
});
