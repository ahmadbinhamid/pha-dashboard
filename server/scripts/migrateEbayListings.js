// scripts/migrateEbayListings.js
//
// One-time backfill: creates a MarketplaceListing (ebay discriminator) for every
// Product that has eBay data stored on its own document.
//
// Safe to re-run — uses updateOne with $setOnInsert so existing listings are
// skipped, and the compound unique index prevents duplicates.
//
// DOES NOT drop or modify any fields on Product — that is a separate change
// that happens only after sync parity is verified.
//
// Usage:
//   node scripts/migrateEbayListings.js
//   node scripts/migrateEbayListings.js --dry-run

require("dotenv").config();

const mongoose = require("mongoose");
const { connectMongo } = require("../src/loaders/mongoose");
require("../src/models/index");

const Product = require("../src/models/Product");
const MarketplaceListing = require("../src/models/MarketplaceListing");
const { MARKETPLACE_PLATFORM, LISTING_STATE, LISTING_SYNC_STATUS } = require("../src/constants/marketplace.constants");

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  await connectMongo();
  console.log(`[migrate] connected to MongoDB${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);

  // Find all Products that have any eBay data at all
  const products = await Product.find({
    $or: [
      { ebay_listing_id: { $ne: null } },
      { ebay_offer_id: { $ne: null } },
      { ebay_category_id: { $ne: null } },
      { ebay_sync_status: { $ne: "not_listed" } },
    ],
  }).lean();

  console.log(`[migrate] found ${products.length} products with eBay data`);

  let created = 0;
  let skipped = 0;
  let errored = 0;

  for (const product of products) {
    try {
      // Map legacy sync status to new LISTING_SYNC_STATUS values
      const syncStatusMap = {
        not_listed: LISTING_SYNC_STATUS.NOT_LISTED,
        pending: LISTING_SYNC_STATUS.PENDING,
        synced: LISTING_SYNC_STATUS.SYNCED,
        out_of_stock: LISTING_SYNC_STATUS.OUT_OF_STOCK,
        error: LISTING_SYNC_STATUS.ERROR,
      };

      const sync_status = syncStatusMap[product.ebay_sync_status] || LISTING_SYNC_STATUS.NOT_LISTED;
      const state = product.ebay_listing_id ? LISTING_STATE.ACTIVE : LISTING_STATE.DRAFT;

      const filter = {
        product: product._id,
        variant: null,
        platform: MARKETPLACE_PLATFORM.EBAY,
        deleted_at: null,
      };

      const doc = {
        $setOnInsert: {
          product: product._id,
          variant: null,
          platform: MARKETPLACE_PLATFORM.EBAY,
          state,
          sync_status,
          synced_at: product.ebay_synced_at || null,
          external_listing_id: product.ebay_listing_id || null,
          external_offer_id: product.ebay_offer_id || null,
          // eBay discriminator fields
          ebay_category_id: product.ebay_category_id || null,
          condition: product.ebay_condition || "NEW",
        },
      };

      if (DRY_RUN) {
        const existing = await MarketplaceListing.findOne(filter);
        if (existing) {
          console.log(`  [skip] ${product.title} (${product._id}) — listing already exists`);
          skipped++;
        } else {
          console.log(`  [would create] ${product.title} (${product._id}) → state:${state} sync:${sync_status}`);
          created++;
        }
      } else {
        const result = await MarketplaceListing.updateOne(filter, doc, {
          upsert: true,
          setDefaultsOnInsert: true,
        });

        if (result.upsertedCount > 0) {
          console.log(`  [created] ${product.title} (${product._id})`);
          created++;
        } else {
          console.log(`  [skipped] ${product.title} (${product._id}) — already exists`);
          skipped++;
        }
      }
    } catch (err) {
      console.error(`  [error] ${product._id}: ${err.message}`);
      errored++;
    }
  }

  console.log(`\n[migrate] done — created: ${created}, skipped: ${skipped}, errors: ${errored}`);

  if (!DRY_RUN && errored > 0) {
    console.warn("[migrate] some products failed — re-run to retry");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[migrate] fatal:", err.message);
  process.exit(1);
});
