// services/flash-sale-migration.service.js
// One-off: legacy inline flash sales become Discounts the sale features.

const StorefrontSettings = require("../models/StorefrontSettings");
const { upsertDiscountByCode } = require("./discount.service");
const { DISCOUNT_SCOPE, DISCOUNT_TYPE } = require("../constants/discount.constants");

const LEGACY_FIELDS = ["name", "code", "discount_type", "discount_value", "scope", "category_ids", "ends_at"];

// Lean reads return stored fields the current schema no longer declares.
function legacyFilter(tenantId) {
  return {
    "flash_sale.code": { $type: "string", $ne: "" },
    ...(tenantId && { tenant_id: tenantId }),
  };
}

function toDiscountInput(sale) {
  return {
    name: sale.name || `Flash sale ${sale.code}`,
    code: sale.code,
    discount_type: sale.discount_type || DISCOUNT_TYPE.PERCENT,
    discount_value: sale.discount_value || 0,
    scope: sale.scope || DISCOUNT_SCOPE.STOREWIDE,
    category_ids: (sale.category_ids ?? []).map(String),
    ends_at: sale.ends_at ?? null,
    is_automatic: false,
    active: !!sale.active,
  };
}

/** Returns one row per tenant, writes only when dryRun is false. */
async function migrateLegacyFlashSales({ dryRun, tenantId = null }) {
  const docs = await StorefrontSettings.find(legacyFilter(tenantId)).lean();
  const rows = [];
  for (const doc of docs) {
    const input = toDiscountInput(doc.flash_sale);
    if (dryRun) {
      rows.push({ tenantId: String(doc.tenant_id), code: input.code, action: "would migrate" });
      continue;
    }
    const discount = await upsertDiscountByCode(doc.tenant_id, input);
    await StorefrontSettings.updateOne(
      { _id: doc._id },
      {
        $set: { "flash_sale.discount_id": discount._id },
        $unset: Object.fromEntries(LEGACY_FIELDS.map((f) => [`flash_sale.${f}`, ""])),
      },
      { strict: false },
    );
    rows.push({ tenantId: String(doc.tenant_id), code: input.code, action: "migrated" });
  }
  return rows;
}

module.exports = { migrateLegacyFlashSales };
