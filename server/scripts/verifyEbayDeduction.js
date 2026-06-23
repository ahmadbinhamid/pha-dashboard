// scripts/verifyEbayDeduction.js
//
// Verifies that an eBay sale deducted stock EXACTLY ONCE for a given SKU.
//
// Why this exists:
//   A single sale can legitimately write multiple InventoryHistory rows
//   (stock is deducted highest-location-first, so qty 3 might split 2+1
//   across two locations). So row COUNT can't prove "exactly once".
//   The authoritative idempotency record is EbayProcessedOrder, which has a
//   unique index on { orderId, action }. This script uses that as the source
//   of truth and uses InventoryHistory only to corroborate the net quantity.
//
//   It also watches for the cross-key double-apply risk: the poller keys on
//   the Fulfillment orderId while the webhook falls back to notificationId.
//   If the SAME sale is recorded once by the poller AND once by the webhook
//   under different keys, the unique index won't catch it — but two records
//   from different `source` values for the same SKU in the window will.
//
// Usage:
//   node scripts/verifyEbayDeduction.js --sku <SKU> [--qty 1] [--order <orderId>] [--since 120]
//
//   --sku    (required) the SKU that was sold
//   --qty    expected quantity sold (default 1) — the net deduction should equal this
//   --order  (optional) restrict the EbayProcessedOrder check to one orderId
//   --since  look-back window in minutes for "recent" activity (default 120)

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

// Register the models we read from.
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const InventoryHistory = require("../src/models/InventoryHistory");
const EbayProcessedOrder = require("../src/models/EbayProcessedOrder");
const { ADJUSTMENT_TYPE } = require("../src/constants/inventory.constants");

// Mirror of inventory.service's fallback SKU pattern.
const FALLBACK_SKU_RE = /^ph-([0-9a-f]{24})(?:-([0-9a-f]{24}))?$/;

// ── tiny arg parser ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

// ── colours (no dependency) ───────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
};
const pass = (s) => `${c.green}${s}${c.reset}`;
const fail = (s) => `${c.red}${s}${c.reset}`;
const warn = (s) => `${c.yellow}${s}${c.reset}`;

// Mirror inventory.service resolveSkuToIds — read-only, models only.
async function resolveSkuToIds(sku) {
  const match = sku.match(FALLBACK_SKU_RE);
  if (match) return { productId: match[1], variantId: match[2] || null };

  const variant = await ProductVariant.findOne({ sku }).lean();
  if (variant) {
    return {
      productId: variant.product.toString(),
      variantId: variant._id.toString(),
    };
  }

  const product = await Product.findOne({ sku }).lean();
  if (product) return { productId: product._id.toString(), variantId: null };

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sku = args.sku;
  const expectedQty = Number(args.qty || 1);
  const orderId = args.order || null;
  const sinceMinutes = Number(args.since || 120);

  if (!sku || sku === true) {
    console.error(
      `${c.red}Missing --sku${c.reset}\n` +
        `Usage: node scripts/verifyEbayDeduction.js --sku <SKU> [--qty 1] [--order <orderId>] [--since 120]`,
    );
    process.exit(2);
  }

  if (!process.env.MONGO_URI) {
    console.error(`${c.red}MONGO_URI is not set in server/.env${c.reset}`);
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

  console.log(`${c.bold}eBay deduction check${c.reset}`);
  console.log(
    `${c.dim}SKU=${sku}  expectedQty=${expectedQty}  window=${sinceMinutes}m  ${
      orderId ? `order=${orderId}` : "order=(any)"
    }${c.reset}\n`,
  );

  // 1) Resolve the SKU to product / variant ──────────────────────────────────
  const ids = await resolveSkuToIds(sku);
  if (!ids) {
    console.log(fail(`✗ SKU not found — no product or variant matches "${sku}".`));
    console.log(
      `${c.dim}  Nothing could have been deducted; check the SKU is correct and synced.${c.reset}`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  const { productId, variantId } = ids;
  console.log(
    `Resolved → product ${c.cyan}${productId}${c.reset}` +
      (variantId ? `  variant ${c.cyan}${variantId}${c.reset}` : `  (no variant)`),
  );

  // 2) Authoritative: EbayProcessedOrder records that touched this SKU ─────────
  const epoQuery = {
    "lineItems.sku": sku,
    processedAt: { $gte: since },
  };
  if (orderId) epoQuery.orderId = orderId;

  const processed = await EbayProcessedOrder.find(epoQuery)
    .sort({ processedAt: 1 })
    .lean();

  const deductions = processed.filter((p) => p.action === "deduction");
  const restocks = processed.filter((p) => p.action === "restock");

  console.log(`\n${c.bold}EbayProcessedOrder (authoritative)${c.reset}`);
  if (!processed.length) {
    console.log(
      warn(
        `  ⚠ No processed-order records reference this SKU in the last ${sinceMinutes}m.`,
      ),
    );
    console.log(
      `${c.dim}  Either the sale hasn't been picked up yet (poller runs every 60s),` +
        ` or the line item carried a different SKU.${c.reset}`,
    );
  } else {
    for (const p of processed) {
      const qtyForSku = (p.lineItems || [])
        .filter((li) => li.sku === sku)
        .reduce((s, li) => s + (Number(li.quantity) || 0), 0);
      console.log(
        `  • ${p.action.padEnd(9)} order=${p.orderId}  source=${p.source}` +
          `  qty(${sku})=${qtyForSku}  at=${new Date(p.processedAt).toISOString()}`,
      );
    }
  }

  // Cross-key double-apply detector: same SKU deducted under >1 distinct key,
  // and/or by both poller and webhook in the window.
  const deductionOrderIds = [...new Set(deductions.map((d) => d.orderId))];
  const deductionSources = [...new Set(deductions.map((d) => d.source))];
  const crossKeyDuplicate =
    deductions.length > 1 &&
    (deductionOrderIds.length > 1 || deductionSources.length > 1);

  // 3) Corroborating: InventoryHistory ebay_sale rows in the window ────────────
  const histQuery = {
    product: productId,
    variant: variantId || null,
    type: ADJUSTMENT_TYPE.EBAY_SALE,
    created_at: { $gte: since },
  };
  // base.model may use createdAt instead of created_at — query both safely.
  let history = await InventoryHistory.find(histQuery)
    .sort({ created_at: 1, createdAt: 1 })
    .lean();
  if (!history.length) {
    const alt = { ...histQuery };
    delete alt.created_at;
    alt.createdAt = { $gte: since };
    history = await InventoryHistory.find(alt).sort({ createdAt: 1 }).lean();
  }

  const negRows = history.filter((h) => h.adjustment < 0);
  const posRows = history.filter((h) => h.adjustment > 0);
  const netAdjustment = history.reduce((s, h) => s + (h.adjustment || 0), 0);
  const totalDeducted = negRows.reduce((s, h) => s + Math.abs(h.adjustment), 0);
  const totalRestored = posRows.reduce((s, h) => s + h.adjustment, 0);

  console.log(`\n${c.bold}InventoryHistory (ebay_sale, corroborating)${c.reset}`);
  if (!history.length) {
    console.log(`${c.dim}  No ebay_sale rows in the window.${c.reset}`);
  } else {
    for (const h of history) {
      const sign = h.adjustment < 0 ? "" : "+";
      console.log(
        `  • ${sign}${h.adjustment}  ${h.stock_before}→${h.stock_after}` +
          `  loc=${h.location}  ${c.dim}${h.reason || ""}${c.reset}`,
      );
    }
    console.log(
      `  ${c.dim}deducted=${totalDeducted}  restored=${totalRestored}  net=${netAdjustment}${c.reset}`,
    );
  }

  // 4) Verdict ────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}Verdict${c.reset}`);
  const problems = [];
  const notes = [];

  // 4a. Idempotency record count.
  if (deductions.length === 0) {
    notes.push(
      "No deduction record yet — wait for the next poll cycle (≤60s) or re-fire the webhook, then re-run.",
    );
  } else if (deductions.length === 1) {
    notes.push("Exactly one deduction record — idempotency held. ✓");
  } else if (crossKeyDuplicate) {
    problems.push(
      `Found ${deductions.length} deduction records for this SKU across ` +
        `${deductionOrderIds.length} key(s) and source(s) [${deductionSources.join(
          ", ",
        )}]. This is the poller/webhook cross-key double-apply — the same sale ` +
        `was recorded under different keys. Resolve the real orderId in the webhook ` +
        `instead of falling back to notificationId.`,
    );
  } else {
    notes.push(
      `${deductions.length} deduction records, but they look like distinct orders (same key would have been blocked by the unique index).`,
    );
  }

  // 4b. Net quantity sanity (only meaningful when there were no restocks).
  if (history.length) {
    if (restocks.length === 0 && posRows.length === 0) {
      if (totalDeducted === expectedQty) {
        notes.push(`Net deducted ${totalDeducted} == expected ${expectedQty}. ✓`);
      } else if (totalDeducted === expectedQty * 2) {
        problems.push(
          `Net deducted ${totalDeducted} == 2× expected (${expectedQty}). Stock was deducted TWICE.`,
        );
      } else {
        notes.push(
          `Net deducted ${totalDeducted}, expected ${expectedQty} — investigate (split across locations is fine if the sum matches).`,
        );
      }
    } else {
      notes.push(
        `Restocks present (cancellation/return) — net adjustment ${netAdjustment}; quantity assertion skipped.`,
      );
    }
  }

  notes.forEach((n) => console.log(`  ${pass("•")} ${n}`));
  problems.forEach((p) => console.log(`  ${fail("✗")} ${p}`));

  let exitCode;
  if (problems.length) {
    console.log(`\n${fail("RESULT: FAIL")} — duplicate or incorrect deduction detected.`);
    exitCode = 1;
  } else if (deductions.length === 1) {
    console.log(`\n${pass("RESULT: PASS")} — deduction applied exactly once.`);
    exitCode = 0;
  } else {
    console.log(
      `\n${warn("RESULT: INCONCLUSIVE")} — not enough recorded yet; re-run after the next poll cycle.`,
    );
    exitCode = 3;
  }

  await mongoose.disconnect();
  process.exit(exitCode);
}

main().catch(async (err) => {
  console.error(`${c.red}Error:${c.reset} ${err.message}`);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(2);
});