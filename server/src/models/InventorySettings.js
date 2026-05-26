// models/InventorySettings.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");

const inventorySettingsSchema = buildSchema(
  {
    // Singleton sentinel — DB-level unique index prevents a second document
    key: { type: String, default: "global", immutable: true },

    low_stock_threshold: { type: Number, default: 10 },
    email_notifications: { type: Boolean, default: false },
    notification_email: { type: String, default: null },
    notification_send_time: { type: String, default: "09:00" },
  },
  { softDelete: false },
);

// Unique index on `key` — DB refuses a second document at the storage layer
inventorySettingsSchema.index({ key: 1 }, { unique: true });

inventorySettingsSchema.statics.getOrCreate = async function () {
  // findOneAndUpdate with upsert is atomic — no race condition
  return this.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

module.exports = model("InventorySettings", inventorySettingsSchema);
