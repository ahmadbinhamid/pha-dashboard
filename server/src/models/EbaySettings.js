// models/EbaySettings.js
//
// One record per tenant: authorizes our single eBay app (client_id/secret stay global in config.ebay.*) and stores their own refresh_token, like a Stripe Connect account.

const { model, Schema } = require("mongoose");
const { EBAY_CONNECTION_STATUS } = require("../constants/ebay.constants");

const ebaySettingsSchema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    // OAuth token from consent flow (ebay.oauth.service.js), never set by admin; encrypted at rest (AES-256-GCM, tokenCipher.js) — only ebay.settings.service.js decrypts it.
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

    // Warehouse address — used to auto-create the merchant location on eBay if missing for this tenant.
    warehouse_street: { type: String, default: null },
    warehouse_city: { type: String, default: null },
    warehouse_state: { type: String, default: null },
    warehouse_postcode: { type: String, default: null },
    warehouse_country: { type: String, default: "AU" },
    warehouse_phone: { type: String, default: null },

    // Sandbox-only fallback when no HTTPS product image is available.
    fallback_image_url: { type: String, default: null },

    // webhook_token is an opaque per-tenant id (not the real _id) in the shared callback URL, so it can't be enumerated; verification_token is the actual HMAC secret eBay signs deliveries with.
    webhook_token: { type: String, default: null, unique: true, sparse: true },
    verification_token: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false },
);

module.exports = model("EbaySettings", ebaySettingsSchema);
