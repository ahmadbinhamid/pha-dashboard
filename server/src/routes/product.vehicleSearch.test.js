// routes/product.vehicleSearch.test.js
// GET /product as the list page calls it: blank params, vehicle + year range.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Product = require("../models/Product");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

let server;
let baseUrl;

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

async function makeTenantUser() {
  const tenantId = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenantId, name: `Vehicle ${suffix}`, slug: `vehicle-${suffix}`, code: `VS${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(tenantId);
  const { insertedId } = await User.collection.insertOne({
    tenant_id: tenantId, first_name: "Ve", last_name: "Hicle", email: `vehicle-${suffix}@example.com`,
    password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
  });
  await addMember({ tenantId, userId: insertedId, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
  return { tenantId, token: signJwt({ sub: String(insertedId), role: "user" }) };
}

const makeProduct = (tenantId, extra) => {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: tenantId, title: `Part ${suffix}`, slug: `part-${suffix}`, ...extra });
};

async function list(token, query) {
  const res = await fetch(`${baseUrl}/product?${new URLSearchParams(query)}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  return { status: res.status, body, ids: (body.data?.items ?? []).map((p) => String(p._id)).sort() };
}

// The list page's exact request shape: every filter param, blank when unset.
const PAGE_PARAMS = { search: "", status: "", stock: "", channel: "", categories: "", page: "1", limit: "15" };
const BLANK_VEHICLE = { make: "", model: "", model_code: "", year_from: "", year_to: "", year: "" };

test("GET /product with blank vehicle params returns every product, not a 400", async () => {
  const { tenantId, token } = await makeTenantUser();
  const products = [await makeProduct(tenantId, {}), await makeProduct(tenantId, { vehicle: { make: "Toyota" } })];
  const res = await list(token, { ...PAGE_PARAMS, ...BLANK_VEHICLE });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.ids, products.map((p) => String(p._id)).sort());
});

test("make/model plus a year range: any fitment whose years overlap", async () => {
  const { tenantId, token } = await makeTenantUser();
  const camry = await makeProduct(tenantId, { vehicle: { make: "Toyota", model: "Camry", year_from: 2012, year_to: 2017 } });
  const extra = await makeProduct(tenantId, {
    vehicle: { make: "Lexus", model: "ES" },
    additional_fitments: [{ make: "toyota", model: "camry", year_from: 2015, year_to: null }],
  });
  await makeProduct(tenantId, {});
  const id = (p) => String(p._id);
  const find = async (vehicle) => {
    const res = await list(token, { ...PAGE_PARAMS, ...BLANK_VEHICLE, ...vehicle });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.ids;
  };

  assert.deepEqual(await find({ make: "Toyota", model: "Camry" }), [id(camry), id(extra)].sort());
  assert.deepEqual(await find({ make: "Toyota", year_from: "2019" }), [id(extra)], "2015+ overlaps; 2012-2017 doesn't");
  assert.deepEqual(await find({ make: "Toyota", year_to: "2013" }), [id(camry)], "2012-2017 overlaps; 2015+ doesn't");
  assert.deepEqual(await find({ make: "Toyota", year_from: "2016", year_to: "2016" }), [id(camry), id(extra)].sort());
  assert.deepEqual(await find({ year_from: "2018" }), [id(extra)], "years alone skip vehicle-less products");
});

test("a non-numeric year is still rejected", async () => {
  const { token } = await makeTenantUser();
  const res = await list(token, { ...PAGE_PARAMS, year_from: "soon" });
  assert.equal(res.status, 400);
});
