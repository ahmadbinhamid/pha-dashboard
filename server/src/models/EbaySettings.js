// models/EbaySettings.js
// Legacy per-tenant eBay link; app keys stay global, refresh token is theirs.

const { model, Schema } = require("mongoose");
const { EBAY_CONNECTION_STATUS } = require("../constants/ebay.constants");

const ebaySettingsSchema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    // OAuth-only, AES-256-GCM; only ebay.settings.service.js decrypts it.
    refresh_token_ciphertext: { type: String, default: null, select: false },
    refresh_token_iv: { type: String, default: null, select: false },
    refresh_token_tag: { type: String, default: null, select: false },

    connection_status: {
      type: String,
      enum: Object.values(EBAY_CONNECTION_STATUS),
      default: EBAY_CONNECTION_STATUS.NOT_CONNECTED,
    },
    connected_at: { type: Date, default: null },
    last_error: { type: String, default: null },

    marketplace_id: { type: String, default: "EBAY_AU" },
    sandbox: { type: Boolean, default: false },

    merchant_location_key: { type: String, default: null },
    fulfillment_policy_id: { type: String, default: null },
    payment_policy_id: { type: String, default: null },
    return_policy_id: { type: String, default: null },

    // Auto-creates the tenant's eBay merchant location when it's missing.
    warehouse_street: { type: String, default: null },
    warehouse_city: { type: String, default: null },
    warehouse_state: { type: String, default: null },
    warehouse_postcode: { type: String, default: null },
    warehouse_country: { type: String, default: "AU" },
    warehouse_phone: { type: String, default: null },

    // Opaque webhook URL id (not _id, so unguessable); the HMAC secret is next.
    webhook_token: { type: String, default: null, unique: true, sparse: true },
    verification_token: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false },
);

module.exports = model("EbaySettings", ebaySettingsSchema);
