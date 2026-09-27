// models/Counter.js
//
// Atomic sequence generator (findOneAndUpdate $inc); _id must be namespaced per tenant, e.g. "${tenantId}:order_number" — see order.service.js and scripts/backfillTenantId.js.

const { model, Schema } = require("mongoose");

const counterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "order_number"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

module.exports = model("Counter", counterSchema);
