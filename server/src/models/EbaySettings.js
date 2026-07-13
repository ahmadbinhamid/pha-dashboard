// models/EbaySettings.js
// Singleton — one record per installation (findOne / findOneAndUpdate upsert)

const { model, Schema } = require("mongoose");

const ebaySettingsSchema = new Schema(
  {
    merchant_location_key: { type: String, default: null },
    fulfillment_policy_id: { type: String, default: null },
    payment_policy_id: { type: String, default: null },
    return_policy_id: { type: String, default: null },
    verification_token: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false },
);

module.exports = model("EbaySettings", ebaySettingsSchema);
