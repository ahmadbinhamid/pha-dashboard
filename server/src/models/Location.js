// models/Location.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const locationSchema = buildSchema({
  // Was missing entirely — every Location was a single global pool shared
  // across all tenants (no query could have scoped by tenant even if it
  // tried to). Any tenant could read, edit, or delete any other tenant's
  // warehouse/showroom locations, and every Inventory record pointing at a
  // location leaked that location's identity across tenants too. Found
  // live, the moment a second real tenant existed. Backfilled onto every
  // pre-existing Location by scripts/backfillLocationTenantId.js.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: null },
  is_active: { type: Boolean, default: true },
});

module.exports = model("Location", locationSchema);
