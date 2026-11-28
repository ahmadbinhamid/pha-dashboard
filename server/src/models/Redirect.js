// models/Redirect.js
// An old storefront path sent on to a new one, applied server-side.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { REDIRECT_TYPE } = require("../constants/seo.constants");

const redirectSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    // Normalised: leading slash, no trailing slash, lower-case, no query.
    from_path: { type: String, required: true },
    // A storefront path or a full https:// URL.
    to_path: { type: String, required: true, trim: true },
    type: { type: Number, enum: Object.values(REDIRECT_TYPE), default: REDIRECT_TYPE.PERMANENT },
    hits: { type: Number, default: 0 },
    last_hit_at: { type: Date, default: null },
  },
  { softDelete: false },
);

redirectSchema.index({ tenant_id: 1, from_path: 1 }, { unique: true });

module.exports = model("Redirect", redirectSchema);
