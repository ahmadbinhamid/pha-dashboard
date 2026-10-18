// services/discount-migration.service.js
// One-off: legacy audience fields become min/max order-number ranges.

const Discount = require("../models/Discount");

const LEGACY_FIELDS = { audience: "", returning_scope: "", kind: "" };

// first_time -> order 1, returning -> 2nd only, or 2nd onwards.
function toOrderRange({ audience, returning_scope }) {
  if (audience === "first_time") return { min_order_number: 1, max_order_number: 1 };
  if (audience === "returning") {
    return returning_scope === "second_order"
      ? { min_order_number: 2, max_order_number: 2 }
      : { min_order_number: 2, max_order_number: null };
  }
  return { min_order_number: null, max_order_number: null };
}

/** Returns one row per migrated discount, writes only when dryRun is false. */
async function migrateLegacyAudience({ dryRun, tenantId = null }) {
  const filter = {
    $or: [{ audience: { $exists: true } }, { kind: { $exists: true } }],
    ...(tenantId && { tenant_id: tenantId }),
  };
  const docs = await Discount.collection.find(filter).toArray();
  const rows = [];
  for (const doc of docs) {
    const range = toOrderRange(doc);
    if (!dryRun) await Discount.collection.updateOne({ _id: doc._id }, { $set: range, $unset: LEGACY_FIELDS });
    rows.push({ name: doc.name, ...range, action: dryRun ? "would migrate" : "migrated" });
  }
  return rows;
}

module.exports = { migrateLegacyAudience };
