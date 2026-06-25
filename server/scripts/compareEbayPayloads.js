// scripts/compareEbayPayloads.js
//
// Builds BOTH the legacy eBay payloads (buildInventoryItem / buildOffer) and
// the new resolved-listing payloads (buildInventoryItemFromResolved /
// buildOfferFromResolved) for a given product and prints a JSON diff.
//
// No eBay API calls are made — output is the JSON bodies only.
//
// Usage:
//   node scripts/compareEbayPayloads.js <productId> [quantity]
//
// Example:
//   node scripts/compareEbayPayloads.js 664f1a2b3c4d5e6f7a8b9c0d
//   node scripts/compareEbayPayloads.js 664f1a2b3c4d5e6f7a8b9c0d 10

require("dotenv").config();
const { connectMongo } = require("../src/loaders/mongoose");
require("../src/models/index");

const Product = require("../src/models/Product");
const {
  buildInventoryItem,
  buildOffer,
  buildInventoryItemFromResolved,
  buildOfferFromResolved,
  loadSettings,
} = require("../src/services/ebay/ebay.api.service");

// ── Simple recursive diff ─────────────────────────────────────────────────────

function diffObjects(legacy, next, path = "") {
  const diffs = [];
  const allKeys = new Set([
    ...Object.keys(legacy || {}),
    ...Object.keys(next || {}),
  ]);

  for (const key of allKeys) {
    const p = path ? `${path}.${key}` : key;
    const lv = legacy?.[key];
    const nv = next?.[key];

    if (lv === undefined) {
      diffs.push(`  + ${p}: ${JSON.stringify(nv)}`);
    } else if (nv === undefined) {
      diffs.push(`  - ${p}: ${JSON.stringify(lv)}`);
    } else if (
      typeof lv === "object" && lv !== null &&
      typeof nv === "object" && nv !== null &&
      !Array.isArray(lv) && !Array.isArray(nv)
    ) {
      diffs.push(...diffObjects(lv, nv, p));
    } else if (JSON.stringify(lv) !== JSON.stringify(nv)) {
      diffs.push(`  ~ ${p}:`);
      diffs.push(`      legacy : ${JSON.stringify(lv)}`);
      diffs.push(`      new    : ${JSON.stringify(nv)}`);
    }
  }
  return diffs;
}

function printSection(label, legacy, next) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));

  const lines = diffObjects(legacy, next);
  if (lines.length === 0) {
    console.log("  (identical)\n");
  } else {
    console.log(lines.join("\n"));
    console.log();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const productId = process.argv[2];
  const quantity = Number(process.argv[3] ?? 5);

  if (!productId) {
    console.error("Usage: node scripts/compareEbayPayloads.js <productId> [quantity]");
    process.exit(1);
  }

  await connectMongo();

  const product = await Product.findById(productId)
    .populate("attachments")
    .lean();

  if (!product) {
    console.error(`Product not found: ${productId}`);
    process.exit(1);
  }

  const settings = await loadSettings();

  // ── Legacy SKU (mirrors inventory.service.getSkuForRecord for a product-only record)
  const legacySku = product.sku || `ph-${product._id}`;

  // ── Legacy payloads
  const legacyInventoryItem = buildInventoryItem(product, legacySku, quantity);
  const legacyOffer = buildOffer(product, legacySku, settings, quantity);

  // ── Resolved object — mirrors what resolveListing() produces when there are no
  //    listing-level overrides (i.e. the listing falls straight through to Product fields)
  const resolved = {
    sku: legacySku,
    title: product.title,
    description: product.description || product.title,
    price: product.price ?? 0,
    brand: product.brand || null,
    photos: product.attachments || [],
    listing: {
      store_sku: product.sku || null,
      condition: product.ebay_condition || "FOR_PARTS_OR_NOT_WORKING",
      item_specifics: {},
      format: "FIXED_PRICE",
      ebay_category_id: product.ebay_category_id || null,
      fulfillment_policy_id: null,
      payment_policy_id: null,
      return_policy_id: null,
      merchant_location_key: null,
      accept_best_offer: false,
      min_best_offer: null,
    },
    product,
    variant: null,
  };

  // ── New payloads
  const newInventoryItem = buildInventoryItemFromResolved(resolved, quantity);
  const newOffer = buildOfferFromResolved(resolved, settings, quantity);

  // ── Print
  console.log(`\nProduct  : ${product.title}`);
  console.log(`ID       : ${product._id}`);
  console.log(`SKU      : ${legacySku}`);
  console.log(`Quantity : ${quantity}`);

  console.log("\n\n== INVENTORY ITEM ==");
  console.log("\n  LEGACY:");
  console.log(JSON.stringify(legacyInventoryItem, null, 2).replace(/^/gm, "    "));
  console.log("\n  NEW:");
  console.log(JSON.stringify(newInventoryItem, null, 2).replace(/^/gm, "    "));
  printSection("INVENTORY ITEM DIFF  (+ added  - removed  ~ changed)", legacyInventoryItem, newInventoryItem);

  console.log("\n\n== OFFER ==");
  console.log("\n  LEGACY:");
  console.log(JSON.stringify(legacyOffer, null, 2).replace(/^/gm, "    "));
  console.log("\n  NEW:");
  console.log(JSON.stringify(newOffer, null, 2).replace(/^/gm, "    "));
  printSection("OFFER DIFF  (+ added  - removed  ~ changed)", legacyOffer, newOffer);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
