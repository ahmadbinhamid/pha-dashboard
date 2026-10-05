// models/ShippingSettings.js
// Per-tenant calculated-shipping setup: Transdirect key and ship-from address.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ADDRESS_TYPE } = require("../constants/shipping.constants");

const shippingSettingsSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    // Packed tokenCipher output; only shipping-settings.service decrypts it.
    transdirect_api_key_ct: { type: String, default: null, select: false },
    sender_postcode: { type: String, default: null, trim: true },
    sender_suburb: { type: String, default: null, trim: true },
    sender_state: { type: String, default: null, trim: true },
    sender_type: { type: String, enum: Object.values(ADDRESS_TYPE), default: ADDRESS_TYPE.BUSINESS },
  },
  { softDelete: false },
);

module.exports = model("ShippingSettings", shippingSettingsSchema);
