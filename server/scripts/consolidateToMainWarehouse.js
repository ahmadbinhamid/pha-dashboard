// scripts/consolidateToMainWarehouse.js
//
// Per tenant: keeps only the Location named "Main Warehouse" (case-insensitive),
// deletes every other Location that tenant owns, and makes sure nothing is
// left pointing at a deleted location:
//   - Inventory at another location for a product/variant that Main
//     Warehouse doesn't already track: repointed to Main Warehouse (a plain
//     move, no merge needed).
//   - Inventory at another location for a product/variant Main Warehouse
//     ALREADY has a row for: stock_count/stock_reserved summed into Main
//     Warehouse's existing row, then the other row deleted (can't just
//     repoint — Inventory's {product, variant, location} unique index would
//     collide).
//   - InventoryHistory at another location: repointed to Main Warehouse
//     (history rows have no uniqueness constraint, always a plain move —
//     never dropped, per "mark them as main warehouse as well").
//
// Only Inventory/InventoryHistory reference Location at the schema level
// (grep for `ref: "Location"` across server/src/models confirms this) — so
// deleting a Location, once nothing above still points at it, is safe.
//
// A tenant with no Location literally named "Main Warehouse" is skipped
// entirely and reported — never guesses which of several locations to keep.
//
// Usage:
//   node scripts/consolidateToMainWarehouse.js            # dry run
//   node scripts/consolidateToMainWarehouse.js --write     # apply

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

const WRITE = process.argv.includes("--write");

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${config.mongoUri}) — mode: ${WRITE ? "WRITE" : "DRY RUN"}`);
  const db = mongoose.connection.db;

  const tenants = await db.collection("locations").distinct("tenant_id");
  console.log(`Tenants with at least one location: ${tenants.length}`);

  for (const tenantId of tenants) {
    const locations = await db.collection("locations").find({ tenant_id: tenantId }).toArray();
    const main = locations.find((l) => l.name.trim().toLowerCase() === "main warehouse");

    console.log(`\n── Tenant ${tenantId} — ${locations.length} location(s): ${locations.map((l) => l.name).join(", ")}`);

    if (!main) {
      console.log(`  SKIPPED — no location literally named "Main Warehouse" for this tenant.`);
      continue;
    }
    const others = locations.filter((l) => String(l._id) !== String(main._id));
    if (others.length === 0) {
      console.log(`  Nothing to do — already just "Main Warehouse".`);
      continue;
    }
    const otherIds = others.map((l) => l._id);
    console.log(`  Keeping "${main.name}" (${main._id}), removing: ${others.map((l) => l.name).join(", ")}`);

    // ── Inventory ──
    const otherInventory = await db.collection("inventories").find({ location: { $in: otherIds } }).toArray();
    let moved = 0, merged = 0, mergedStock = 0, mergedReserved = 0;

    for (const inv of otherInventory) {
      const mainRow = await db.collection("inventories").findOne({
        product: inv.product,
        variant: inv.variant ?? null,
        location: main._id,
      });

      if (!mainRow) {
        moved++;
        if (WRITE) {
          await db.collection("inventories").updateOne({ _id: inv._id }, { $set: { location: main._id } });
        }
      } else {
        merged++;
        mergedStock += inv.stock_count || 0;
        mergedReserved += inv.stock_reserved || 0;
        if (WRITE) {
          if (inv.stock_count || inv.stock_reserved) {
            await db.collection("inventories").updateOne(
              { _id: mainRow._id },
              { $inc: { stock_count: inv.stock_count || 0, stock_reserved: inv.stock_reserved || 0 } },
            );
          }
          await db.collection("inventories").deleteOne({ _id: inv._id });
        }
      }
    }
    console.log(`  Inventory: ${moved} row(s) moved to Main Warehouse, ${merged} row(s) merged into an existing Main Warehouse row` +
      (mergedStock || mergedReserved ? ` (carried over ${mergedStock} stock_count + ${mergedReserved} stock_reserved — not silently dropped)` : ""));

    // ── InventoryHistory ── always a plain move, no uniqueness constraint
    const histCount = await db.collection("inventoryhistories").countDocuments({ location: { $in: otherIds } });
    console.log(`  InventoryHistory: ${histCount} row(s) to repoint to Main Warehouse`);
    if (WRITE && histCount > 0) {
      await db.collection("inventoryhistories").updateMany({ location: { $in: otherIds } }, { $set: { location: main._id } });
    }

    // ── Locations ──
    console.log(`  Locations: ${others.length} to delete`);
    if (WRITE) {
      await db.collection("locations").deleteMany({ _id: { $in: otherIds } });
    }
  }

  if (!WRITE) {
    console.log("\nDry run only — nothing was written. Re-run with --write to apply.");
  } else {
    console.log("\nDone.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("consolidateToMainWarehouse failed:", err);
  process.exit(1);
});
