// models/Customer.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const addressSchema = new Schema(
  {
    address: { type: String, required: true },
    suburb: { type: String, required: true },
    state: { type: String, required: true },
    postcode: { type: String, required: true },
  },
  { _id: false },
);

const customerSchema = buildSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true, default: null },
  phone: { type: String, trim: true, default: null },
  // True once this customer has a real storefront login (vs. a walk-in/POS
  // record created purely to track orders) — informational only for now.
  has_online_account: { type: Boolean, default: false },
  registered_at: { type: Date, default: null },
  shipping_address: { type: addressSchema, default: null },
  billing_address: { type: addressSchema, default: null }, // null => same as shipping
});

// Partial index: only enforce uniqueness among documents that actually have
// an email, so multiple walk-in customers with no email never collide.
customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null, email: { $type: "string" } } },
);
customerSchema.index({ name: 1 });

module.exports = model("Customer", customerSchema);
