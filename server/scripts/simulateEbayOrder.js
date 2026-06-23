// scripts/simulateEbayOrder.js
//
// Tests the "eBay → App" direction (a sale on eBay reduces your app's stock)
// WITHOUT needing eBay's flaky sandbox checkout.
//
// How: it runs your REAL poller (pollAndProcessOrders) but replaces only the
// one eBay network call (getOrders) with a canned order. Everything else —
// adjustStockBySku, the multi-location deduction, InventoryHistory writes, and
// the EbayProcessedOrder idempotency guard — is your actual production code.
//
// It runs the poll TWICE with the same order to prove two things at once:
//   1) Run 1 deducts stock by the sold quantity   → cross-sync works
//   2) Run 2 changes nothing                       → idempotency holds (no double-count)
//
// By default it RESTORES your stock and removes the test records afterwards,
// so you can run it as many times as you like without draining real inventory.
// Pass --keep to leave the deduction in place.
//
// Usage:
//   node scripts/simulateEbayOrder.js --sku <SKU> [--qty 1] [--keep]
//
//   --sku   (required) the SKU to "sell"
//   --qty   quantity sold (default 1)
//   --keep  do NOT restore stock / cleanup — leave the deduction in the DB

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

// Register schemas before anything reads them.
require("../src/models/index");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const InventoryHistory = require("../src/models/InventoryHistory");
const EbayProcessedOrder = require("../src/models/EbayProcessedOrder");
const { ADJUSTMENT_TYPE } = require("../src/constants/inventory.constants");

const FALLBACK_SKU_RE = /^ph-([0-9a-f]{24})(?:-([0-9a-f]{24}))?$/;

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", dim: "\x1b[2m", cyan: "\x1b[36m",
};
const ok = (s) => `${c.green}${s}${c.reset}`;
const bad = (s) => `${c.red}${s}${c.reset}`;
const warn = (s) => `${c.yellow}${s}${c.reset}`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

async function resolveSkuToIds(sku) {
  const match = sku.match(FALLBACK_SKU_RE);
  if (match) return { productId: match[1], variantId: match[2] || null };
  const variant = await ProductVariant.findOne({ sku }).lean();
  if (variant) return { productId: variant.product.toString(), variantId: variant._id.toString() };
  const product = await Product.findOne({ sku }).lean();
  if (product) return { productId: product._id.toString(), variantId: null };
  return null;
}

async function snapshotStock(productId, variantId) {
  const records = await Inventory.find({
    product: productId,
    variant: variantId || null,
  }).lean();
  const map = new Map();
  let total = 0;
  for (const r of records) {
    map.set(r._id.toString(), r.stock_count);
    total += r.stock_count;
  }
  return { map, total, count: records.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sku = args.sku;
  const qty = Number(args.qty || 1);
  const keep = !!args.keep;

  if (!sku || sku === true) {
    console.error(
      `${c.red}Missing --sku${c.reset}\n` +
        `Usage: node scripts/simulateEbayOrder.js --sku <SKU> [--qty 1] [--keep]`,
    );
    process.exit(2);
  }
  if (!process.env.MONGO_URI) {
    console.error(`${c.red}MONGO_URI is not set in server/.env${c.reset}`);
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log(`${c.bold}Simulate eBay → App sync${c.reset}`);
  console.log(`${c.dim}SKU=${sku}  qty=${qty}  mode=${keep ? "keep" : "restore after"}${c.reset}\n`);

  // Resolve + pre-checks ────────────────────────────────────────────────────
  const ids = await resolveSkuToIds(sku);
  if (!ids) {
    console.log(bad(`✗ SKU "${sku}" doesn't match any product or variant — nothing to deduct.`));
    await mongoose.disconnect();
    process.exit(1);
  }
  const { productId, variantId } = ids;

  const before = await snapshotStock(productId, variantId);
  if (before.count === 0) {
    console.log(bad(`✗ No inventory records for this SKU. Add stock first, then re-run.`));
    await mongoose.disconnect();
    process.exit(1);
  }
  if (before.total < qty) {
    console.log(
      warn(`⚠ Stock on hand (${before.total}) is less than qty sold (${qty}). ` +
        `Deduction will stop at 0 and the numbers below won't match a clean sale. ` +
        `Consider topping up stock first.`),
    );
  }

  const testOrderId = `TEST-${Date.now()}`;
  const testStart = new Date();
  const cannedOrder = {
    orders: [{ orderId: testOrderId, lineItems: [{ sku, quantity: qty }] }],
  };

  // Stub ONLY getOrders, then load the real poller so it picks up the stub ───
  const apiService = require("../src/services/ebay/ebay.api.service");
  apiService.getOrders = async () => cannedOrder;
  const { pollAndProcessOrders } = require("../src/services/ebay/ebay.orders.service");

  console.log(`Stock before:        ${c.cyan}${before.total}${c.reset}  (across ${before.count} location record(s))`);

  // Run 1 — should deduct ────────────────────────────────────────────────────
  const run1 = await pollAndProcessOrders();
  const after1 = await snapshotStock(productId, variantId);
  const dropped1 = before.total - after1.total;
  console.log(`After run 1:         ${c.cyan}${after1.total}${c.reset}  (dropped ${dropped1}, poller reported processed=${run1.processed})`);

  // Run 2 — same order, should be a no-op (idempotency) ───────────────────────
  const run2 = await pollAndProcessOrders();
  const after2 = await snapshotStock(productId, variantId);
  const dropped2 = after1.total - after2.total;
  console.log(`After run 2 (same):  ${c.cyan}${after2.total}${c.reset}  (dropped ${dropped2}, poller reported processed=${run2.processed})`);

  // Evidence ──────────────────────────────────────────────────────────────────
  const epo = await EbayProcessedOrder.find({ orderId: testOrderId }).lean();
  const histRows = await InventoryHistory.find({
    product: productId,
    variant: variantId || null,
    type: ADJUSTMENT_TYPE.EBAY_SALE,
    created_at: { $gte: testStart },
  }).lean();

  console.log(`\n${c.bold}Evidence${c.reset}`);
  console.log(`  EbayProcessedOrder records for ${testOrderId}: ${epo.length} ${epo.map((e) => `(${e.action}/${e.source})`).join(" ")}`);
  console.log(`  InventoryHistory ebay_sale rows written:      ${histRows.length}`);

  // Verdict (plain English) ────────────────────────────────────────────────────
  console.log(`\n${c.bold}Verdict${c.reset}`);
  const expectedDrop = Math.min(qty, before.total);
  const deductionRecords = epo.filter((e) => e.action === "deduction").length;
  const problems = [];

  if (dropped1 === expectedDrop && dropped1 > 0) {
    console.log(`  ${ok("•")} Run 1 reduced stock by ${dropped1} — eBay→App deduction works.`);
  } else {
    problems.push(`Run 1 reduced stock by ${dropped1}, expected ${expectedDrop}.`);
  }

  if (dropped2 === 0 && run2.processed === 0) {
    console.log(`  ${ok("•")} Run 2 (same order) changed nothing — idempotency holds, no double-count.`);
  } else {
    problems.push(`Run 2 reduced stock by ${dropped2} (processed=${run2.processed}) — idempotency FAILED, the same order was applied twice.`);
  }

  if (deductionRecords === 1) {
    console.log(`  ${ok("•")} Exactly one deduction record was written.`);
  } else {
    problems.push(`Expected 1 deduction record, found ${deductionRecords}.`);
  }

  problems.forEach((p) => console.log(`  ${bad("✗")} ${p}`));

  // Cleanup (default) or keep ──────────────────────────────────────────────────
  if (!keep) {
    for (const [id, original] of before.map.entries()) {
      await Inventory.updateOne({ _id: id }, { $set: { stock_count: original } });
    }
    await InventoryHistory.deleteMany({
      product: productId,
      variant: variantId || null,
      type: ADJUSTMENT_TYPE.EBAY_SALE,
      created_at: { $gte: testStart },
    });
    await EbayProcessedOrder.deleteMany({ orderId: testOrderId });
    const restored = await snapshotStock(productId, variantId);
    console.log(`\n${c.dim}Cleanup: stock restored to ${restored.total}, ${histRows.length} test history row(s) and ${epo.length} test order record(s) removed. (Use --keep to skip cleanup.)${c.reset}`);
  } else {
    console.log(`\n${c.dim}--keep set: deduction left in place. Test order id = ${testOrderId}.${c.reset}`);
  }

  const failed = problems.length > 0;
  console.log(
    failed
      ? `\n${bad("RESULT: FAIL")} — see the ✗ lines above.`
      : `\n${ok("RESULT: PASS")} — a simulated eBay sale correctly synced into your app, exactly once.`,
  );

  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(`${c.red}Error:${c.reset} ${err.message}`);
  try { await mongoose.disconnect(); } catch {}
  process.exit(2);
});