// Removes a sold-out SKU's stuck eBay record; next sync publishes it fresh.
// Usage: --sku=<product SKU> [--tenant=<id>] [--confirm]  (dry run by default)

const { resetEbayListing } = require("../src/services/ebay/ebay.listing-reset.service");

const MESSAGES = {
  not_found: () => "No eBay listing found for that SKU.",
  not_connected: () => "eBay isn't connected for this tenant.",
  live: (r) => `eBay reports ${r.ebaySku} as live (offer ${r.offerId}); nothing changed.`,
  would_reset: (r) => `Would delete eBay's record for ${r.ebaySku} (offer ${r.offerId ?? "none"}). Re-run with --confirm.`,
  ebay_refused: (r) => `eBay refused to delete ${r.ebaySku}: ${r.error}. Contact eBay support about this SKU.`,
  reset: (r) => `Done: eBay's record for ${r.ebaySku} removed. Click Re-sync on the eBay row to publish it fresh.`,
};

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");
  require("../src/services/marketplace/registerAdapters").registerAdapters();

  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const sku = arg("sku");
  const tenant = arg("tenant");
  if (!sku || (tenant && !mongoose.isValidObjectId(tenant))) {
    console.error("Usage: node scripts/resetEbayListing.js --sku=<SKU> [--tenant=<ObjectId>] [--confirm]");
    process.exit(1);
  }
  const confirm = process.argv.includes("--confirm");

  (async () => {
    await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false });
    console.log(confirm ? "Connected (--confirm: will change eBay and this listing)" : "Connected (dry run: no changes)");
    const result = await resetEbayListing(sku, tenant ? new mongoose.Types.ObjectId(tenant) : null, { confirm });
    console.log(MESSAGES[result.outcome](result));
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("resetEbayListing failed:", err.message);
    process.exit(1);
  });
}

module.exports = { MESSAGES };
