// models/Customer.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { CUSTOMER_SOURCE } = require("../constants/customer.constants");
const { NAME_COLLATION } = require("./Business");

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
  // Representatives of one business are separate customers sharing this id.
  business_id: { type: Schema.Types.ObjectId, ref: "Business", default: null },
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

// business_id in the key keeps it distinct from the legacy tenant+email index.
customerSchema.index(
  { tenant_id: 1, email: 1, business_id: 1 },
  {
    name: "unique_email_without_business",
    unique: true,
    partialFilterExpression: { deleted_at: null, business_id: null, email: { $type: "string" } },
  },
);
// Reps may share a business inbox, only an identical name+email is a dupe.
customerSchema.index(
  { tenant_id: 1, business_id: 1, email: 1, name: 1 },
  {
    name: "unique_rep_per_business",
    unique: true,
    collation: NAME_COLLATION,
    partialFilterExpression: {
      deleted_at: null,
      business_id: { $type: "objectId" },
      email: { $type: "string" },
    },
  },
);
customerSchema.index({ name: 1 });
// Representatives of a business, and the business-name branch of search.
customerSchema.index({ tenant_id: 1, business_id: 1 });
// Covers listCustomers: filter by tenant_id, newest first.
customerSchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("Customer", customerSchema);
