/**
 * Phase C migration: $unset legacy eBay fields from products and variants.
 *
 * These fields have been superseded by the MarketplaceListing collection.
 * Phase A backfill confirmed all data is preserved before this runs.
 *
 * Usage:
 *   DRY_RUN=true  node server/scripts/removeProductEbayFields.js
 *   DRY_RUN=false node server/scripts/removeProductEbayFields.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const DRY_RUN = process.env.DRY_RUN !== "false";

const PRODUCT_UNSET = {
  ebay_listing_id: "",
  ebay_offer_id: "",
  ebay_category_id: "",
  ebay_condition: "",
  ebay_sync_status: "",
  ebay_synced_at: "",
};

const VARIANT_UNSET = {
  ebay_listing_id: "",
  ebay_offer_id: "",
  ebay_sync_status: "",
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(`[Phase C] removeProductEbayFields — DRY_RUN=${DRY_RUN}`);

  const db = mongoose.connection.db;
  const products = db.collection("products");
  const variants = db.collection("productvariants");

  // ── Count affected documents ──────────────────────────────────────────────

  const [productCount, variantCount] = await Promise.all([
    products.countDocuments({
      $or: Object.keys(PRODUCT_UNSET).map((k) => ({ [k]: { $exists: true } })),
    }),
    variants.countDocuments({
      $or: Object.keys(VARIANT_UNSET).map((k) => ({ [k]: { $exists: true } })),
    }),
  ]);

  console.log(`\nProducts with legacy eBay fields: ${productCount}`);
  console.log(`Variants with legacy eBay fields:  ${variantCount}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes written. Re-run with DRY_RUN=false to apply.");
    await mongoose.disconnect();
    return;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  const [pResult, vResult] = await Promise.all([
    products.updateMany(
      { $or: Object.keys(PRODUCT_UNSET).map((k) => ({ [k]: { $exists: true } })) },
      { $unset: PRODUCT_UNSET },
    ),
    variants.updateMany(
      { $or: Object.keys(VARIANT_UNSET).map((k) => ({ [k]: { $exists: true } })) },
      { $unset: VARIANT_UNSET },
    ),
  ]);

  console.log(`\nProducts updated: ${pResult.modifiedCount}`);
  console.log(`Variants updated:  ${vResult.modifiedCount}`);
  console.log("\n[Phase C] Done.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
