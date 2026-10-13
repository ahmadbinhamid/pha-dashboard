// controllers/product.controller.vehicleSearch.test.js
// Text search plus make/model/year: any fitment and the year fit. Needs Mongo.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");

const searchService = require("../services/search/product.search.service");
const productController = require("./product.controller");
const Product = require("../models/Product");
require("../models/Attachment");
require("../models/Category");

before(async () => {
  await mongoose.connect(config.mongoUri);
});
after(async () => {
  await mongoose.disconnect();
});
afterEach(() => mock.restoreAll());

function fakeRes() {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const makeProduct = (tenantId, extra) => {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: tenantId, title: `Brake pads ${suffix}`, slug: `pads-${suffix}`, status: "active", ...extra });
};

// Typesense returns every product as a text hit; the vehicle filter narrows.
async function searchWith(tenantId, products, query) {
  const search = mock.method(searchService, "searchProducts", async () => ({ ids: products.map((p) => String(p._id)), total: products.length }));
  const res = fakeRes();
  await productController.getProducts(
    { query: { search: "brake pads", ...query }, tenantId, user: { _id: fixtureId() }, pagination: { page: 1, limit: 20, skip: 0 } },
    res,
  );
  assert.equal(res.statusCode, 200);
  return { ids: res.body.data.items.map((p) => String(p._id)).sort(), total: res.body.data.total, typesenseArgs: search.mock.calls[0].arguments[0] };
}

test("search + make/model/year: matches vehicle 1 or any extra fitment, within the years", async () => {
  const tenantId = fixtureId();
  const camry = await makeProduct(tenantId, { vehicle: { make: "Toyota", model: "Camry", year_from: 2012, year_to: 2017 } });
  const extra = await makeProduct(tenantId, {
    vehicle: { make: "Lexus", model: "ES" },
    additional_fitments: [{ make: "toyota", model: "camry", year_from: 2015, year_to: null }],
  });
  const corolla = await makeProduct(tenantId, { vehicle: { make: "Toyota", model: "Corolla", year_from: 2012 } });
  const all = [camry, extra, corolla];

  const byModel = await searchWith(tenantId, all, { make: "Toyota", model: "Camry" });
  assert.deepEqual(byModel.ids, [camry, extra].map((p) => String(p._id)).sort(), "extra fitment and case-insensitive");
  assert.equal(byModel.total, 2);

  const in2020 = await searchWith(tenantId, all, { make: "Toyota", model: "Camry", year: 2020 });
  assert.deepEqual(in2020.ids, [String(extra._id)], "open-ended year_to fits; 2012-2017 doesn't");

  const makeOnly = await searchWith(tenantId, all, { make: "toyota" });
  assert.equal(makeOnly.total, 3);
});

test("search without a vehicle is unchanged, and Typesense never gets make/model", async () => {
  const tenantId = fixtureId();
  const a = await makeProduct(tenantId, { vehicle: { make: "Toyota", model: "Camry" } });
  const b = await makeProduct(tenantId, {});
  const plain = await searchWith(tenantId, [a, b], {});
  assert.deepEqual(plain.ids, [a, b].map((p) => String(p._id)).sort());

  const filtered = await searchWith(tenantId, [a, b], { make: "Toyota" });
  assert.equal(filtered.typesenseArgs.make, undefined);
  assert.equal(filtered.typesenseArgs.model, undefined);
});

test("search + multi-select lists narrow the text hits", async () => {
  const tenantId = fixtureId();
  const camry = await makeProduct(tenantId, { vehicle: { make: "Toyota", model: "Camry", year_from: 2012, year_to: 2017 } });
  const civic = await makeProduct(tenantId, { vehicle: { make: "Honda", model: "Civic", year_from: 2016 } });
  const mazda = await makeProduct(tenantId, { vehicle: { make: "Mazda", model: "3" } });
  const { ids } = await searchWith(tenantId, [camry, civic, mazda], { makes: "toyota,Honda", years: "2017" });
  assert.deepEqual(ids, [camry, civic].map((p) => String(p._id)).sort());
});
