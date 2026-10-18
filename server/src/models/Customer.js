// models/Customer.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { CUSTOMER_SOURCE } = require("../constants/customer.constants");

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
  // Backfilled by scripts/backfillTenantId.js, email's unique index includes it.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  // Shown on invoices instead of `name` when present.
  company_name: { type: String, trim: true, default: null },
  email: { type: String, lowercase: true, trim: true, default: null },
  phone: { type: String, trim: true, default: null },
  // True once the customer has a storefront login, informational for now.
  has_online_account: { type: Boolean, default: false },
  registered_at: { type: Date, default: null },
  shipping_address: { type: addressSchema, default: null },
  billing_address: { type: addressSchema, default: null }, // null => same as shipping
  source: { type: String, enum: Object.values(CUSTOMER_SOURCE), default: CUSTOMER_SOURCE.STAFF },
  // Consent from the checkout box, campaigns may only email opted-in customers.
  marketing_opt_in: { type: Boolean, default: false },
  marketing_opt_in_at: { type: Date, default: null },
});

// Partial: unique only where email exists, so emailless walk-ins never collide.
customerSchema.index(
  { tenant_id: 1, email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null, email: { $type: "string" } } },
);
customerSchema.index({ name: 1 });
// Covers listCustomers: filter by tenant_id, newest first.
customerSchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("Customer", customerSchema);
