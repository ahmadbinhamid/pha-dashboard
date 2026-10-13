// utils/productFilter.fitments.test.js
// Vehicle filters match the default vehicle or any additional fitment. Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
const Product = require("../models/Product");
const { buildProductFilter, buildFitmentFilter } = require("./productFilter");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const product = (tenantId, extra) => {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: tenantId, title: `Fit ${suffix}`, slug: `fit-${suffix}`, ...extra });
};

test("make/model/year match default vehicle or an additional fitment", async () => {
  const tenantId = fixtureId();
  const outlander = { make: "Mitsubishi", model: "Outlander", model_code: "GF", year_from: 2015, year_to: 2019 };
  const both = await product(tenantId, { vehicle: outlander, additional_fitments: [{ make: "Mitsubishi", model: "ASX", year_from: 2016 }] });
  const onlyDefault = await product(tenantId, { vehicle: outlander });
  const find = async (query) =>
    (await Product.find(buildProductFilter(query, { authenticated: true, tenantId })).select("_id").lean()).map((p) => String(p._id)).sort();

  assert.deepEqual(await find({ make: "Mitsubishi", model: "Outlander" }), [both, onlyDefault].map((p) => String(p._id)).sort());
  assert.deepEqual(await find({ model: "ASX", year: 2022 }), [String(both._id)], "open-ended year_to");
  assert.deepEqual(await find({ model: "ASX", year: 2014 }), [], "before year_from");
  assert.deepEqual(await find({ model: "Outlander", year: 2021 }), [], "after the default's year_to");
});

test("vehicle match ignores case and surrounding spaces; blank values filter nothing", async () => {
  const tenantId = fixtureId();
  const civic = await product(tenantId, { vehicle: { make: "honda", model: "Civic", year_from: 2012, year_to: 2015 } });
  const find = async (query) =>
    (await Product.find(buildProductFilter(query, { authenticated: true, tenantId })).select("_id").lean()).map((p) => String(p._id));

  assert.deepEqual(await find({ make: " Honda ", model: "CIVIC" }), [String(civic._id)]);
  assert.deepEqual(await find({ make: "Hond" }), [], "whole value only, not a prefix");
  assert.deepEqual(await find({ make: "h.nda" }), [], "regex characters are literal");
  assert.equal(buildFitmentFilter({ make: "  ", model: "" }), null);
});
