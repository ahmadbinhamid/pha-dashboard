// models/DiscountCode.js
// A code issued to one email for a unique-code discount, e.g. a signup offer.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const discountCodeSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    discount_id: { type: Schema.Types.ObjectId, ref: "Discount", required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    // Only a checkout with this email can use the code.
    email: { type: String, required: true, trim: true, lowercase: true },
    expires_at: { type: Date, default: null },
  },
  { softDelete: false },
);

discountCodeSchema.index({ tenant_id: 1, code: 1 }, { unique: true });
// One code per email per offer, so signing up again returns the same code.
discountCodeSchema.index({ discount_id: 1, email: 1 }, { unique: true });

module.exports = model("DiscountCode", discountCodeSchema);
