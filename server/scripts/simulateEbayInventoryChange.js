// scripts/simulateEbayInventoryChange.js
//
// Tests the "eBay -> App" inventory-sync poller (ebay.inventory-sync.service.js)
// WITHOUT needing to actually edit a live eBay listing. It runs the REAL
// reconcile function but stubs only the one eBay network call
// (getAllInventoryItems) with a canned response.
//
// Two modes:
//
//   Quantity change (default):
//     node scripts/simulateEbayInventoryChange.js --sku <SKU> --qty <NEW_QTY> [--keep]
//     Simulates eBay's quantity for this SKU changing to --qty, and proves:
//       1) Run 1 applies the delta to local stock
//       2) Run 2 (same eBay qty) is a no-op — idempotency holds
//
//   Listing deletion (--simulate-delete):
//     node scripts/simulateEbayInventoryChange.js --sku <SKU> --simulate-delete [--keep]
//     Simulates the SKU disappearing from eBay's inventory entirely, and
//     proves the listing gets soft-deleted locally after the configured
//     consecutive-miss threshold (2 polls) — not on the first miss, since a
//     single miss is treated as a possible transient API blip.
//
// By default both modes restore everything afterwards (stock, sync baseline,
// listing) so you can run this repeatedly without side effects. Pass --keep
// to leave the result in place.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

require("../src/models/index");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const InventoryHistory = require("../src/models/InventoryHistory");
const MarketplaceListing = require("../src/models/MarketplaceListing");
const { ADJUSTMENT_TYPE } = require("../src/constants/inventory.constants");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../src/constants/marketplace.constants");
const { resolveSkuToIds } = require("../src/services/inventory.service");
const { resolveSku } = require("../src/services/marketplace/listing.resolver");

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

async function snapshotStock(productId, variantId) {
  const records = await Inventory.find({ product: productId, variant: variantId || null }).lean();
  const map = new Map();
  let total = 0;
  for (const r of records) {
    map.set(r._id.toString(), r.stock_count);
    total += r.stock_count;
  }
  return { map, total, count: records.length };
}

async function findActiveListing(productId, variantId) {
  return MarketplaceListing.findOne({
    product: productId,
    variant: variantId || null,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
  });
}

async function runQuantityChangeTest({ sku, qty, keep, productId, variantId, listing }) {
  const { reconcileEbayInventory } = require("../src/services/ebay/ebay.inventory-sync.service");
  const ebayApi = require("../src/services/ebay/ebay.api.service");

  const before = await snapshotStock(productId, variantId);
  if (before.count === 0) {
    console.log(bad(`✗ No inventory records for this SKU. Add stock first, then re-run.`));
    return false;
  }

  // Force a known, deterministic baseline rather than trusting whatever's
  // already stored, so the test's expected delta is exact.
  const originalBaseline = listing.ebay_synced_quantity;
  const originalMissingPolls = listing.ebay_missing_polls;
  listing.ebay_synced_quantity = before.total;
  listing.ebay_missing_polls = 0;
  await listing.save();

  const newQty = Number(qty);
  const testStart = new Date();

  ebayApi.getAllInventoryItems = async () => ([
    { sku, availability: { shipToLocationAvailability: { quantity: newQty } } },
  ]);

  console.log(`Baseline (forced):   ${c.cyan}${before.total}${c.reset}`);
  console.log(`Simulated eBay qty:  ${c.cyan}${newQty}${c.reset}`);

  const run1 = await reconcileEbayInventory();
  const after1 = await snapshotStock(productId, variantId);
  console.log(`After run 1:         ${c.cyan}${after1.total}${c.reset}  (reconciled=${run1.reconciled})`);

  const run2 = await reconcileEbayInventory();
  const after2 = await snapshotStock(productId, variantId);
  console.log(`After run 2 (same):  ${c.cyan}${after2.total}${c.reset}  (reconciled=${run2.reconciled})`);

  const histRows = await InventoryHistory.find({
    product: productId,
    variant: variantId || null,
    type: ADJUSTMENT_TYPE.EBAY_MANUAL_ADJUSTMENT,
    created_at: { $gte: testStart },
  }).lean();

  console.log(`\n${c.bold}Evidence${c.reset}`);
  console.log(`  InventoryHistory ebay_manual_adjustment rows written: ${histRows.length}`);

  const expectedDelta = newQty - before.total;
  const actualDelta1 = after1.total - before.total;
  const actualDelta2 = after2.total - after1.total;

  const problems = [];
  console.log(`\n${c.bold}Verdict${c.reset}`);

  if (actualDelta1 === expectedDelta) {
    console.log(`  ${ok("•")} Run 1 applied delta ${expectedDelta} — eBay quantity change synced correctly.`);
  } else {
    problems.push(`Run 1 changed stock by ${actualDelta1}, expected ${expectedDelta}.`);
  }

  if (actualDelta2 === 0 && run2.reconciled === 0) {
    console.log(`  ${ok("•")} Run 2 (same eBay qty) changed nothing — idempotency holds.`);
  } else {
    problems.push(`Run 2 changed stock by ${actualDelta2} (reconciled=${run2.reconciled}) — idempotency FAILED.`);
  }

  if (histRows.length === 1) {
    console.log(`  ${ok("•")} Exactly one reconciliation history row was written.`);
  } else {
    problems.push(`Expected 1 history row, found ${histRows.length}.`);
  }

  problems.forEach((p) => console.log(`  ${bad("✗")} ${p}`));

  if (!keep) {
    for (const [id, original] of before.map.entries()) {
      await Inventory.updateOne({ _id: id }, { $set: { stock_count: original } });
    }
    await InventoryHistory.deleteMany({
      product: productId, variant: variantId || null,
      type: ADJUSTMENT_TYPE.EBAY_MANUAL_ADJUSTMENT, created_at: { $gte: testStart },
    });
    await MarketplaceListing.updateOne(
      { _id: listing._id },
      { $set: { ebay_synced_quantity: originalBaseline, ebay_missing_polls: originalMissingPolls } },
    );
    const restored = await snapshotStock(productId, variantId);
    console.log(`\n${c.dim}Cleanup: stock restored to ${restored.total}, sync baseline and history rows reset. (Use --keep to skip cleanup.)${c.reset}`);
  } else {
    console.log(`\n${c.dim}--keep set: changes left in place.${c.reset}`);
  }

  return problems.length === 0;
}

async function runDeletionTest({ sku, keep, listing }) {
  const { reconcileEbayInventory } = require("../src/services/ebay/ebay.inventory-sync.service");
  const ebayApi = require("../src/services/ebay/ebay.api.service");

  const originalMissingPolls = listing.ebay_missing_polls;
  await MarketplaceListing.updateOne({ _id: listing._id }, { $set: { ebay_missing_polls: 0 } });

  // SKU absent from eBay's own inventory list entirely — simulates it having
  // been deleted directly on eBay (not through this app).
  ebayApi.getAllInventoryItems = async () => ([]);

  console.log(`Simulating SKU ${sku} missing from eBay's inventory list.\n`);

  const run1 = await reconcileEbayInventory();
  let current = await MarketplaceListing.findById(listing._id);
  console.log(`After poll 1: deletedFromEbay=${run1.deletedFromEbay}, listing deleted_at=${current?.deleted_at || "null"} (expected: still live, 1 miss recorded)`);

  const run2 = await reconcileEbayInventory();
  // Soft-deleted docs are excluded by default queries — use withDeleted to check.
  const afterDeleteDoc = await MarketplaceListing.findById(listing._id, null, { withDeleted: true });
  console.log(`After poll 2: deletedFromEbay=${run2.deletedFromEbay}, listing deleted_at=${afterDeleteDoc?.deleted_at || "null"} (expected: deleted after 2nd consecutive miss)`);

  const problems = [];
  console.log(`\n${c.bold}Verdict${c.reset}`);

  if (run1.deletedFromEbay === 0 && !current?.deleted_at) {
    console.log(`  ${ok("•")} First miss did not delete the listing (protects against a single flaky poll).`);
  } else {
    problems.push(`Listing was deleted after only 1 miss — should require a consecutive streak.`);
  }

  if (run2.deletedFromEbay === 1 && afterDeleteDoc?.deleted_at) {
    console.log(`  ${ok("•")} Second consecutive miss deleted the listing locally, matching eBay.`);
  } else {
    problems.push(`Listing was not deleted after 2 consecutive misses as expected.`);
  }

  problems.forEach((p) => console.log(`  ${bad("✗")} ${p}`));

  if (!keep) {
    await MarketplaceListing.restoreById(listing._id);
    await MarketplaceListing.updateOne(
      { _id: listing._id },
      { $set: { ebay_missing_polls: originalMissingPolls } },
    );
    console.log(`\n${c.dim}Cleanup: listing restored. (Use --keep to leave it deleted.)${c.reset}`);
  } else {
    console.log(`\n${c.dim}--keep set: listing left deleted.${c.reset}`);
  }

  return problems.length === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sku = args.sku;
  const simulateDelete = !!args["simulate-delete"];
  const keep = !!args.keep;

  if (!sku || sku === true) {
    console.error(
      `${c.red}Missing --sku${c.reset}\n` +
        `Usage: node scripts/simulateEbayInventoryChange.js --sku <SKU> --qty <NEW_QTY> [--keep]\n` +
        `       node scripts/simulateEbayInventoryChange.js --sku <SKU> --simulate-delete [--keep]`,
    );
    process.exit(2);
  }
  if (!simulateDelete && (!args.qty || args.qty === true)) {
    console.error(`${c.red}Missing --qty (or pass --simulate-delete instead)${c.reset}`);
    process.exit(2);
  }
  if (!process.env.MONGO_URI) {
    console.error(`${c.red}MONGO_URI is not set in server/.env${c.reset}`);
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log(`${c.bold}Simulate eBay inventory-sync${c.reset}`);
  console.log(`${c.dim}SKU=${sku}  mode=${simulateDelete ? "listing deletion" : `quantity change (qty=${args.qty})`}${c.reset}\n`);

  const ids = await resolveSkuToIds(sku);
  if (!ids) {
    console.log(bad(`✗ SKU "${sku}" doesn't match any product or variant.`));
    await mongoose.disconnect();
    process.exit(1);
  }

  const listing = await findActiveListing(ids.productId, ids.variantId);
  if (!listing) {
    console.log(bad(`✗ No ACTIVE eBay listing found for this SKU — publish it to eBay first, then re-run.`));
    await mongoose.disconnect();
    process.exit(1);
  }

  // Confirm the listing's resolved SKU actually matches what was passed in
  // (store_sku overrides, variant SKUs, etc. can differ from a raw product ID).
  const product = await Product.findById(ids.productId).lean();
  const variant = ids.variantId ? await ProductVariant.findById(ids.variantId).lean() : null;
  const resolvedSku = resolveSku(listing, product, variant);
  if (resolvedSku !== sku) {
    console.log(warn(`⚠ Listing resolves to SKU "${resolvedSku}", not "${sku}" — using "${resolvedSku}" for the simulation.`));
  }

  const passed = simulateDelete
    ? await runDeletionTest({ sku: resolvedSku, keep, listing })
    : await runQuantityChangeTest({ sku: resolvedSku, qty: args.qty, keep, productId: ids.productId, variantId: ids.variantId, listing });

  console.log(
    passed
      ? `\n${ok("RESULT: PASS")}`
      : `\n${bad("RESULT: FAIL")} — see the ✗ lines above.`,
  );

  await mongoose.disconnect();
  process.exit(passed ? 0 : 1);
}

main().catch(async (err) => {
  console.error(`${c.red}Error:${c.reset} ${err.message}`);
  try { await mongoose.disconnect(); } catch {}
  process.exit(2);
});
