// models/InventorySettings.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const inventorySettingsSchema = buildSchema(
  {
    // Was a single global singleton (`key: "global"`, unique-indexed) shared
    // by every tenant — one tenant changing low_stock_threshold (or any
    // other field here) silently changed it for every other tenant too,
    // since there was only ever one document in this collection. Replaced
    // with one document per tenant, same upsert-on-first-access pattern.
    // Found live, the moment a second real tenant existed.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    low_stock_threshold: { type: Number, default: 10 },
    email_notifications: { type: Boolean, default: false },
    notification_email: { type: String, default: null },
    notification_send_time: { type: String, default: "09:00" },
  },
  { softDelete: false },
);

inventorySettingsSchema.statics.getOrCreate = async function (tenantId) {
  // findOneAndUpdate with upsert is atomic — no race condition
  return this.findOneAndUpdate(
    { tenant_id: tenantId },
    { $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

module.exports = model("InventorySettings", inventorySettingsSchema);
