// models/Customer.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");

const customerSchema = buildSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true, default: null },
  phone: { type: String, trim: true, default: null },
  // True once this customer has a real storefront login (vs. a walk-in/POS
  // record created purely to track orders) — informational only for now.
  has_online_account: { type: Boolean, default: false },
  registered_at: { type: Date, default: null },
});

// Partial index: only enforce uniqueness among documents that actually have
// an email, so multiple walk-in customers with no email never collide.
customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null, email: { $type: "string" } } },
);
customerSchema.index({ name: 1 });

module.exports = model("Customer", customerSchema);
