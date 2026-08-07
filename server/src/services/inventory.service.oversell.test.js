// services/inventory.service.oversell.test.js
//
// Regression guard: an oversell (deducting more than exists) must leave an
// honest audit trail. Before this fix, InventoryHistory could effectively
// record "nothing happened" for the uncovered portion — either the exact
// requested amount got silently capped with no trace of the shortfall, or
// (for a SKU whose every location record was already at 0) no
// InventoryHistory row was written for the attempt at all. Now: stock still
// clamps at 0, but the row's `adjustment` field is always the TRUE
// requested delta, and `clamped_shortfall` carries the uncovered amount
// separately.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/inventory.service.oversell.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");

// adjustStockForSku fans out to enqueueEbayJob("sync_listing", ...) on every
// real stock change — mock it so this test doesn't need a live Redis, same
// pattern as the other suites in this repo that exercise inventory.service.js.
const ebayQueueModule = require("../queues/ebay.queue");
mock.method(ebayQueueModule, "enqueueEbayJob", async () => {});

// Bull's underlying ioredis client keeps its connection open indefinitely by
// design — without closing it, this process never exits on its own, which
// hangs any multi-file `node --test` run waiting on this one.
test.after(async () => {
  await ebayQueueModule.ebayQueue.close();
});

test("oversell: deducting more than available stock clamps to 0 but records the true adjustment and clamped_shortfall", async (t) => {
  await mongoose.connect(config.mongoUri);

  const Product = require("../models/Product");
  const Location = require("../models/Location");
  const Inventory = require("../models/Inventory");
  const InventoryHistory = require("../models/InventoryHistory");
  const { adjustStockForSku } = require("./inventory.service");

  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const sku = `OVERSELL-${suffix}`;

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Oversell test ${suffix}`,
    slug: `oversell-test-${suffix}`,
    sku,
    status: "active",
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Oversell loc ${suffix}` });
  const inventory = await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 3 });

  // Only 3 in stock, but a sale for 5 comes in — 2 units oversold.
  const result = await adjustStockForSku(sku, -5, {
    reason: "test oversell",
    type: "ebay_sale",
    tenantId,
  });

  assert.equal(result.shortfall, 2, "adjustStockForSku's own shortfall must still be reported");

  const stock = await Inventory.findById(inventory._id);
  assert.equal(stock.stock_count, 0, "stock must clamp at 0, never negative");

  const history = await InventoryHistory.find({ inventory: inventory._id }).sort({ created_at: 1 });

  // Row 1: the real, fully-covered deduction (-3, stock 3 -> 0).
  assert.equal(history[0].adjustment, -3);
  assert.equal(history[0].stock_before, 3);
  assert.equal(history[0].stock_after, 0);
  assert.equal(history[0].clamped_shortfall, 0, "a fully-covered deduction has no shortfall");

  // Row 2: the shortfall itself — must NOT read as if nothing happened.
  assert.equal(history.length, 2, "the oversold portion must produce its own history row, not vanish silently");
  assert.equal(history[1].adjustment, -2, "adjustment must be the TRUE requested amount, not silently rewritten to 0");
  assert.equal(history[1].stock_before, 0);
  assert.equal(history[1].stock_after, 0);
  assert.equal(history[1].clamped_shortfall, 2, "clamped_shortfall must carry the uncovered amount");

  await mongoose.disconnect();
});
