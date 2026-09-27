// models/InventorySettings.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { DIGEST_FREQUENCY, DIGEST_MONTH_DAY_MAX } = require("../constants/inventory.constants");

const inventorySettingsSchema = buildSchema(
  {
    // One settings document per tenant, created on first access.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    low_stock_threshold: { type: Number, default: 10 },
    email_notifications: { type: Boolean, default: false },
    notification_email: { type: String, default: null },
    // "HH:MM" UTC; the frontend converts to and from Sydney time.
    notification_send_time: { type: String, default: "09:00" },
    // Digest dedup: stamped once per UTC day the digest resolves.
    last_digest_sent_at: { type: Date, default: null },
    notification_frequency: { type: String, enum: Object.values(DIGEST_FREQUENCY), default: DIGEST_FREQUENCY.DAILY },
    // Sydney weekday for weekly digests: 0 = Sunday ... 6 = Saturday.
    notification_weekday: { type: Number, min: 0, max: 6, default: 1 },
    notification_month_day: { type: Number, min: 1, max: DIGEST_MONTH_DAY_MAX, default: 1 },
  },
  { softDelete: false },
);

inventorySettingsSchema.statics.getOrCreate = async function (tenantId) {
  // Atomic upsert: concurrent first reads can't create two documents.
  return this.findOneAndUpdate(
    { tenant_id: tenantId },
    { $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

module.exports = model("InventorySettings", inventorySettingsSchema);
