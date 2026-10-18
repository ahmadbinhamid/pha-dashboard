// models/DiscountRedemption.js
// One use of a discount, deleted when its order is cancelled.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const discountRedemptionSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    discount_id: { type: Schema.Types.ObjectId, ref: "Discount", required: true },
    // Set right after the order is created, null only within that window.
    order_id: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    customer_email: { type: String, required: true, lowercase: true, trim: true },
    // Email for once-per-customer discounts, else a unique id, see the index.
    customer_key: { type: String, required: true },
    discount_amount: { type: Number, required: true, min: 0 }, // cents
    order_total: { type: Number, required: true, min: 0 }, // cents
  },
  { softDelete: false },
);

// Enforces once-per-customer atomically when customer_key is the email.
discountRedemptionSchema.index({ discount_id: 1, customer_key: 1 }, { unique: true });
discountRedemptionSchema.index({ order_id: 1 });

module.exports = model("DiscountRedemption", discountRedemptionSchema);
