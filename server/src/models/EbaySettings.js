// models/EbaySettings.js
//
// One record per tenant — each tenant authorizes our single eBay Application
// (client_id/client_secret stay global, config.ebay.*, like a platform key)
// and gets their own refresh_token here, analogous to a Stripe Connect
// connected account. Everything seller-specific (marketplace, warehouse
// address, business policy IDs, webhook credentials) lives here too.

const { model, Schema } = require("mongoose");
const { EBAY_CONNECTION_STATUS } = require("../constants/ebay.constants");

const ebaySettingsSchema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    // OAuth — obtained via the consent flow (ebay.oauth.service.js), never
    // set directly by an admin. Encrypted at rest (AES-256-GCM — see
    // utils/crypto/tokenCipher.js); ebay.settings.service.js is the only
    // place that encrypts/decrypts this, so every other consumer just reads
    // `settings.refresh_token` as plaintext.
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

    // Warehouse address — used to auto-create the merchant location on eBay
    // if it doesn't exist yet for this tenant.
    warehouse_street: { type: String, default: null },
    warehouse_city: { type: String, default: null },
    warehouse_state: { type: String, default: null },
    warehouse_postcode: { type: String, default: null },
    warehouse_country: { type: String, default: "AU" },
    warehouse_phone: { type: String, default: null },

    // Sandbox-only fallback when no HTTPS product image is available.
    fallback_image_url: { type: String, default: null },

    // Webhook — an opaque, unguessable identifier (NOT this tenant's real
    // _id) embedded in the query string of the one shared callback URL
    // (/api/v1/ebay/webhook?wt=<this>), so the URL itself can't be enumerated
    // to find real tenant ids. verification_token is the actual HMAC secret
    // eBay signs deliveries with — checked before anything from a request is
    // trusted, regardless of which tenant the URL claims to be.
    webhook_token: { type: String, default: null, unique: true, sparse: true },
    verification_token: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false },
);

module.exports = model("EbaySettings", ebaySettingsSchema);
