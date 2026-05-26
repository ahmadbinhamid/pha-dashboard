// models/InventorySettings.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");

const inventorySettingsSchema = buildSchema(
  {
    low_stock_threshold: { type: Number, default: 10 },
    email_notifications: { type: Boolean, default: false },
    notification_email: { type: String, default: null },
    notification_send_time: { type: String, default: "09:00" },
  },
  { softDelete: false },
);

inventorySettingsSchema.statics.getOrCreate = async function () {
  let settings = await this.findOne({});
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = model("InventorySettings", inventorySettingsSchema);
