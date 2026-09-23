// models/Location.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const locationSchema = buildSchema({
  // Was missing entirely — every Location was a single global pool any tenant could read/edit/delete.
  // Found live. Backfilled via scripts/backfillLocationTenantId.js.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: null },
  is_active: { type: Boolean, default: true },
});

module.exports = model("Location", locationSchema);
