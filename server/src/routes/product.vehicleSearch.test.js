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
const BLANK_VEHICLE = { makes: "", models: "", model_codes: "", years: "", make: "", model: "", model_code: "", year: "" };

test("GET /product with blank vehicle params returns every product, not a 400", async () => {
  const { tenantId, token } = await makeTenantUser();
  const products = [await makeProduct(tenantId, {}), await makeProduct(tenantId, { vehicle: { make: "Toyota" } })];
  const res = await list(token, { ...PAGE_PARAMS, ...BLANK_VEHICLE });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.ids, products.map((p) => String(p._id)).sort());
});

test("multi-select: any chosen make, model, code and year; any fitment", async () => {
  const { tenantId, token } = await makeTenantUser();
  const camry = await makeProduct(tenantId, { vehicle: { make: "Toyota", model: "Camry", model_code: "XV50", year_from: 2012, year_to: 2017 } });
  const civic = await makeProduct(tenantId, {
    vehicle: { make: "Lexus", model: "ES" },
    additional_fitments: [{ make: "honda", model: "civic", model_code: "FK", year_from: 2016, year_to: null }],
  });
  const mazda = await makeProduct(tenantId, { vehicle: { make: "Mazda", model: "3", year_from: 2010, year_to: 2013 } });
  await makeProduct(tenantId, {});
  const id = (p) => String(p._id);
  const find = async (filters) => {
    const res = await list(token, { ...PAGE_PARAMS, ...BLANK_VEHICLE, ...filters });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.ids;
  };

  assert.deepEqual(await find({ makes: "Toyota,Honda" }), [id(camry), id(civic)].sort(), "any make, any fitment");
  assert.deepEqual(await find({ makes: "Toyota,Honda", models: "Civic" }), [id(civic)]);
  assert.deepEqual(await find({ model_codes: "XV50,FK" }), [id(camry), id(civic)].sort());
  assert.deepEqual(await find({ years: "2011,2020" }), [id(civic), id(mazda)].sort(), "any listed year inside the range");
  assert.deepEqual(await find({ makes: "Toyota,Mazda", years: "2015" }), [id(camry)], "fields combine on one fitment");
  // Lexus ES has no years, so fits any; the vehicle-less product never does.
  assert.deepEqual(await find({ years: "1990" }), [id(civic)], "years alone skip vehicle-less products");
});

test("a non-numeric year is still rejected", async () => {
  const { token } = await makeTenantUser();
  const res = await list(token, { ...PAGE_PARAMS, years: "2015,soon" });
  assert.equal(res.status, 400);
});
