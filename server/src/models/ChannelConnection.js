// models/ChannelConnection.js
// One row per (tenant, platform); supersedes EbaySettings via read-through.

const { model, Schema } = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete.plugin");
const { stripInternalFields } = require("./base.model");
const { CHANNEL_CONNECTION_STATUS, CHANNEL_STATUS_REASON } = require("../constants/channel.constants");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

// Raw Schema, not buildSchema, which drops discriminatorKey.
const baseSchema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    platform: { type: String, required: true },

    status: {
      type: String,
      enum: Object.values(CHANNEL_CONNECTION_STATUS),
      default: CHANNEL_CONNECTION_STATUS.DISCONNECTED,
    },

    // Needed by Google/Meta; eBay has none (resolved via its refresh token).
    external_account_id: { type: String, default: null },

    // One string per token; each consumer packs its {ciphertext,iv,tag} into it.
    access_token_ct: { type: String, default: null, select: false },
    refresh_token_ct: { type: String, default: null, select: false },
    token_expires_at: { type: Date, default: null },

    // Opaque webhook URL id; globally unique since the URL carries no tenant id.
    webhook_token: { type: String, default: null },

    connected_at: { type: Date, default: null },
    last_error: { type: String, default: null },
    // CHANNEL_STATUS_REASON while status is ERROR for an unmet prerequisite.
    status_reason: { type: String, enum: [...Object.values(CHANNEL_STATUS_REASON), null], default: null },

    // Only transport/auth failures (5xx, network, 401/403) count; 400s never do.
    consecutive_failures: { type: Number, default: 0 },
    last_success_at: { type: Date, default: null },
    // Set when this tenant's queue is paused; cleared by the resume path.
    disabled_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    discriminatorKey: "platform",
  },
);

baseSchema.plugin(softDeletePlugin);
baseSchema.set("toJSON", { transform: stripInternalFields });
baseSchema.set("toObject", { transform: stripInternalFields });

baseSchema.index({ tenant_id: 1, platform: 1 }, { unique: true });
// partialFilterExpression, not sparse: webhook_token defaults to null.
baseSchema.index(
  { webhook_token: 1 },
  { unique: true, partialFilterExpression: { webhook_token: { $type: "string" } } },
);

const ChannelConnection = model("ChannelConnection", baseSchema);

// ── eBay discriminator: EbaySettings fields ported 1:1 for toLegacyShape

const ebaySchema = new Schema({
  marketplace_id: { type: String, default: "EBAY_AU" },
  sandbox: { type: Boolean, default: false },

  merchant_location_key: { type: String, default: null },
  fulfillment_policy_id: { type: String, default: null },
  payment_policy_id: { type: String, default: null },
  return_policy_id: { type: String, default: null },

  warehouse_street: { type: String, default: null },
  warehouse_city: { type: String, default: null },
  warehouse_state: { type: String, default: null },
  warehouse_postcode: { type: String, default: null },
  warehouse_country: { type: String, default: "AU" },
  warehouse_phone: { type: String, default: null },

  fallback_image_url: { type: String, default: null },

  // HMAC secret for eBay webhook signatures; not the base URL `webhook_token`.
  verification_token: { type: String, default: null },
});

// Model name != stored value: bare "ebay" collides with MarketplaceListing's.
ChannelConnection.discriminator("ChannelConnectionEbay", ebaySchema, MARKETPLACE_PLATFORM.EBAY);

// ── Google (Merchant API) discriminator

const googleSchema = new Schema({
  merchant_id: { type: String, default: null },
  data_source_id: { type: String, default: null },
  feed_label: { type: String, default: null },
  content_language: { type: String, default: null },
  target_country: { type: String, default: null },
});

// Same collision as eBay, with MarketplaceListing's "google" discriminator.
ChannelConnection.discriminator("ChannelConnectionGoogle", googleSchema, MARKETPLACE_PLATFORM.GOOGLE);

module.exports = ChannelConnection;
