// services/tag.service.test.js
// Tag queue, print log and style, on this file's own fixture tenants.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
const Product = require("../models/Product");
const Location = require("../models/Location");
const Inventory = require("../models/Inventory");
const tagService = require("./tag.service");
const TagSettings = require("../models/TagSettings");
const { DEFAULT_TAG_STYLE, DEFAULT_TAG_FIELDS, TAG_PRINT_SOURCE } = require("../constants/tag.constants");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function productWithStock(tenantId, stock, extra = {}) {
  const suffix = crypto.randomUUID();
  const product = await Product.create({ tenant_id: tenantId, title: `Tag test ${suffix}`, slug: `tag-test-${suffix}`, sku: `TAG-${suffix}`, ...extra });
  const location = await Location.create({ tenant_id: tenantId, name: `Tag loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: stock });
  return product;
}

test("addToQueue: copies default to stock, re-adding sets copies, 0 stock still queues 1", async () => {
  const tenantId = fixtureId();
  const a = await productWithStock(tenantId, 7, { bay: "A3-02" });
  const b = await productWithStock(tenantId, 0);

  await tagService.addToQueue(tenantId, null, { product_id: a._id });
  await tagService.addToQueue(tenantId, null, { product_id: b._id });
  let queue = await tagService.listQueue(tenantId);
  const rowA = queue.find((r) => String(r.product._id) === String(a._id));
  assert.equal(rowA.copies, 7);
  assert.equal(rowA.stock_count, 7);
  assert.equal(rowA.product.bay, "A3-02");
  assert.equal(queue.find((r) => String(r.product._id) === String(b._id)).copies, 1);

  await tagService.addToQueue(tenantId, null, { product_id: a._id, copies: 3 });
  queue = await tagService.listQueue(tenantId);
  assert.equal(queue.length, 2, "one row per product");
  assert.equal(queue.find((r) => String(r.product._id) === String(a._id)).copies, 3);
});

test("addToQueue refuses another tenant's product", async () => {
  const mine = fixtureId();
  const other = await productWithStock(fixtureId(), 2);
  await assert.rejects(tagService.addToQueue(mine, null, { product_id: other._id }), (err) => err.status === 404);
});

test("recordPrint from the queue logs a snapshot and clears only printed rows", async () => {
  const tenantId = fixtureId();
  const a = await productWithStock(tenantId, 2);
  const b = await productWithStock(tenantId, 5);
  await tagService.addToQueue(tenantId, null, { product_id: a._id });
  await tagService.addToQueue(tenantId, null, { product_id: b._id });

  const log = await tagService.recordPrint(tenantId, null, { source: TAG_PRINT_SOURCE.QUEUE, items: [{ product_id: a._id, copies: 2 }] });
  assert.equal(log.total_tags, 2);
  assert.equal(log.items[0].title, a.title);

  const queue = await tagService.listQueue(tenantId);
  assert.deepEqual(queue.map((r) => String(r.product._id)), [String(b._id)]);

  const history = await tagService.listHistory(tenantId, { page: 1, limit: 10, skip: 0 });
  assert.equal(history.total, 1);
  assert.equal(history.items[0].items[0].sku, a.sku);
});

test("recordPrint from a product page leaves the queue alone", async () => {
  const tenantId = fixtureId();
  const a = await productWithStock(tenantId, 1);
  await tagService.addToQueue(tenantId, null, { product_id: a._id });
  await tagService.recordPrint(tenantId, null, { source: TAG_PRINT_SOURCE.PRODUCT, items: [{ product_id: a._id, copies: 1 }] });
  assert.equal((await tagService.listQueue(tenantId)).length, 1);
});

test("increment mode adds one at a time and never exceeds stock", async () => {
  const tenantId = fixtureId();
  const a = await productWithStock(tenantId, 2);
  const add = () => tagService.addToQueue(tenantId, null, { product_id: a._id, mode: "increment" });
  assert.equal((await add()).copies, 1);
  assert.equal((await add()).copies, 2);
  assert.equal((await add()).copies, 2, "capped at the 2 in stock");
  const [row] = await tagService.listQueue(tenantId);
  assert.equal((await tagService.updateQueueItem(tenantId, row._id, { copies: 9 })).copies, 2);
});

test("importUnprinted queues in-stock products never printed, skips printed and queued", async () => {
  const tenantId = fixtureId();
  const fresh = await productWithStock(tenantId, 3);
  const printed = await productWithStock(tenantId, 4);
  const queued = await productWithStock(tenantId, 5);
  await productWithStock(tenantId, 0);
  await tagService.recordPrint(tenantId, null, { source: TAG_PRINT_SOURCE.PRODUCT, items: [{ product_id: printed._id, copies: 1 }] });
  await tagService.addToQueue(tenantId, null, { product_id: queued._id, copies: 1 });

  const result = await tagService.importUnprinted(tenantId, null);
  assert.deepEqual(result, { added: 1, skipped_out_of_stock: 1 });
  const queue = await tagService.listQueue(tenantId);
  const byId = new Map(queue.map((r) => [String(r.product._id), r.copies]));
  assert.equal(byId.get(String(fresh._id)), 3, "one tag per unit");
  assert.equal(byId.get(String(queued._id)), 1, "an existing row is left as queued");
  assert.ok(!byId.has(String(printed._id)));
  assert.deepEqual(await tagService.importUnprinted(tenantId, null), { added: 0, skipped_out_of_stock: 1 }, "idempotent");
});

test("style: defaults on first read, partial update keeps the rest", async () => {
  const tenantId = fixtureId();
  const initial = await tagService.getStyle(tenantId);
  assert.deepEqual(initial.fields.map((f) => f.key), DEFAULT_TAG_FIELDS.map((f) => f.key));
  const fields = [...initial.fields].reverse().map((f) => (f.key === "note" ? { ...f, visible: false } : f));
  const saved = await tagService.updateStyle(tenantId, { font: "courier", fields });
  assert.equal(saved.font, "courier");
  assert.equal(saved.align, DEFAULT_TAG_STYLE.align);
  assert.deepEqual(saved.fields.map((f) => f.key), fields.map((f) => f.key), "order kept");
  assert.equal(saved.fields.find((f) => f.key === "note").visible, false);
});

test("style: legacy show_*/title_size docs read as fields", async () => {
  const tenantId = fixtureId();
  await TagSettings.collection.insertOne({ tenant_id: tenantId, font: "times", show_note: false, title_size: "lg" });
  const style = await tagService.getStyle(tenantId);
  assert.equal(style.font, "times");
  assert.equal(style.fields.find((f) => f.key === "note").visible, false);
  assert.equal(style.fields.find((f) => f.key === "title").size_pt, 9.5);
});
