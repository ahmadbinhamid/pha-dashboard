// models/Counter.js
//
// Generic atomic sequence generator. Order numbers are assigned via
// findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true })
// which Mongo guarantees is atomic even under concurrent checkouts.
//
// Multi-tenant: `_id` itself is the discriminator (there's no separate
// tenant_id column here), so every caller must namespace its key per tenant,
// e.g. `${tenantId}:order_number` instead of the old bare "order_number" —
// see order.service.js and scripts/backfillTenantId.js (which copies each
// pre-existing global counter doc to the PHA tenant's namespaced _id).

const { model, Schema } = require("mongoose");

const counterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "order_number"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

module.exports = model("Counter", counterSchema);
