// Finds products with stock tracking off and turns it on, resyncing channels.
// Usage: [--tenant=<id>] [--confirm]  (dry run by default; safe to re-run)

const { enableStockTracking } = require("../src/services/stock-tracking.service");

function report({ confirmed, products }, log) {
  if (!products.length) return log("No products have stock tracking off. Nothing to do.");
  log(`${products.length} product(s) with stock tracking off:`);
  for (const p of products) {
    log(`  ${p.sku ?? p._id}  stock ${p.stock}  channels: ${p.channels.join(", ") || "none"}  ${p.title}`);
  }
  log(
    confirmed
      ? "\nDone: tracking on; listed products queued to push their real stock."
      : "\nDry run: nothing changed. Re-run with --confirm to turn tracking on.",
  );
}

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");
  require("../src/services/marketplace/registerAdapters").registerAdapters();

  const tenant = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];
  if (tenant && !mongoose.isValidObjectId(tenant)) {
    console.error("Usage: node scripts/enableStockTracking.js [--tenant=<ObjectId>] [--confirm]");
    process.exit(1);
  }
  const confirm = process.argv.includes("--confirm");

  (async () => {
    await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false });
    const result = await enableStockTracking({ tenantId: tenant ? new mongoose.Types.ObjectId(tenant) : null, confirm });
    report(result, console.log);
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error("enableStockTracking failed:", err.message);
    process.exit(1);
  });
}

module.exports = { report };
