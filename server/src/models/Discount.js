// models/Discount.js
// A storefront discount: code or automatic, with targeting and limits.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { DISCOUNT_TYPE, DISCOUNT_SCOPE, MAX_ORDER_NUMBER } = require("../constants/discount.constants");

const discountSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  // Null for automatic discounts, unique per tenant otherwise (service-checked).
  code: { type: String, default: null, trim: true, uppercase: true },
  is_automatic: { type: Boolean, default: false },
  discount_type: { type: String, enum: Object.values(DISCOUNT_TYPE), required: true },
  // Percent (1-90) or dollars by discount_type, 0 for free shipping.
  discount_value: { type: Number, default: 0, min: 0 },
  // Dollars, the cart subtotal must reach it. 0 means no minimum.
  minimum_order: { type: Number, default: 0, min: 0 },
  scope: { type: String, enum: Object.values(DISCOUNT_SCOPE), default: DISCOUNT_SCOPE.STOREWIDE },
  category_ids: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  starts_at: { type: Date, default: null },
  ends_at: { type: Date, default: null },
  // Null is unlimited, usage_count moves only via atomic $inc.
  usage_limit: { type: Number, default: null, min: 1 },
  usage_count: { type: Number, default: 0, min: 0 },
  once_per_customer: { type: Boolean, default: false },
  // Which of the shopper's orders qualify (1 = first), null bounds are open.
  min_order_number: { type: Number, default: null, min: 1, max: MAX_ORDER_NUMBER },
  max_order_number: { type: Number, default: null, min: 1, max: MAX_ORDER_NUMBER },
  active: { type: Boolean, default: true },
});

discountSchema.index({ tenant_id: 1, code: 1 });
discountSchema.index({ tenant_id: 1, is_automatic: 1, active: 1 });

module.exports = model("Discount", discountSchema);
