// Read-only: prints what a sync would send eBay; --live adds eBay's GET view.
// Usage: --sku=<product SKU> [--tenant=<id>] [--live]

const { previewEbayInventoryItem } = require("../src/services/ebay/ebay.payload-preview.service");

const DESCRIPTION_PREVIEW_CHARS = 200;

function report({ listingId, syncError, stored, item, offer, images, liveState }, log) {
  const description = item.product.description || "";
  const shown = {
    ...item,
    product: { ...item.product, description: `${description.slice(0, DESCRIPTION_PREVIEW_CHARS)}… (${description.length} chars)` },
  };
  log(`\n== Listing ${listingId}`);
  log(`  last sync error: ${syncError ?? "(none)"}`);
  log(`  our record: status ${stored.syncStatus}, eBay item ${stored.ebayItemId ?? "-"}, offer ${stored.offerId ?? "-"}`);
  log(`  last qty eBay confirmed: ${stored.lastConfirmedQty ?? "-"} at ${stored.syncedAt ?? "-"}`);
  log(`  qty we send now: ${item.availability?.shipToLocationAvailability?.quantity ?? "none (stock not tracked)"}`);
  log("\n== Inventory item sent to eBay");
  log(JSON.stringify(shown, null, 2));
  const { listingDescription, ...offerShown } = offer;
  log("\n== Offer sent to eBay (description omitted)");
  log(JSON.stringify({ ...offerShown, listingDescription: `(${listingDescription?.length ?? 0} chars)` }, null, 2));
  log("\n== Photos (eBay must be able to fetch each one)");
  for (const img of images) {
    const verdict = img.status === 200 && img.type?.startsWith("image/") ? "ok" : "PROBLEM";
    log(`  ${verdict}  ${img.status ?? "no response"}  ${img.type ?? ""}  ${img.bytes ?? "?"} bytes  ${img.url}${img.error ? `  (${img.error})` : ""}`);
  }
  if (!liveState) return;
  log("\n== eBay now (GET only)");
  if (liveState.error) return log(`  ${liveState.error}`);
  log(`  inventory item: ${liveState.inventoryItem ? JSON.stringify(liveState.inventoryItem.availability ?? "(no availability)") : "(not on eBay)"}`);
  for (const o of liveState.offers) {
    log(`  offer ${o.offerId}: status ${o.status}, qty ${o.availableQuantity ?? "?"}, location ${o.merchantLocationKey ?? "(none)"}, listing ${o.listing?.listingId ?? "-"}`);
  }
  log(`  offer's location: ${liveState.location ? `${liveState.location.key} (${liveState.location.status})` : "NOT FOUND on eBay"}`);
  log(`  all locations: ${liveState.allLocationKeys.join(", ") || "(none)"}`);
  for (const [part, message] of Object.entries(liveState.readErrors)) {
    if (message) log(`  eBay failed to read ${part}: ${message}`);
  }
}

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
    console.error("Usage: node scripts/previewEbayInventoryItem.js --sku=<SKU> [--tenant=<ObjectId>]");
    process.exit(1);
  }

  (async () => {
    // NOTE: autoIndex/autoCreate off, else connect issues createIndex writes.
    await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false });
    console.log("Connected to MongoDB (read-only: no writes; --live makes eBay GETs only)");
    const live = process.argv.includes("--live");
    const preview = await previewEbayInventoryItem(sku, tenant ? new mongoose.Types.ObjectId(tenant) : null, { live });
    if (!preview) console.log(`No eBay listing found for SKU ${sku}.`);
    else report(preview, console.log);
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("previewEbayInventoryItem failed:", err.message);
    process.exit(1);
  });
}

module.exports = { report };
