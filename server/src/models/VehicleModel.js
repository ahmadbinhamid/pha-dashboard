// models/VehicleModel.js
//
// Hybrid catalog: a shared, platform-wide base (tenant_id: null — the
// seeded fitment data every tenant sees) plus per-tenant custom entries a
// tenant adds themselves (e.g. typing a make/model/year Combobox doesn't
// recognize). A custom entry is scoped to the tenant that created it and
// must never be visible to, or selectable by, any other tenant — see
// vehicle-model.service.js for the read-side {tenant_id: null OR mine}
// filter this depends on.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const vehicleModelSchema = buildSchema(
  {
    // null = global/shared (seeded platform data). Set = owned by that
    // tenant only. Mongo's {tenant_id: null} query matches both an explicit
    // null AND a missing field, so pre-existing seeded documents (which
    // predate this field) are already correctly "global" with no backfill
    // needed.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    model_code: { type: String, default: "", trim: true },
    year_from: { type: Number, required: true },
    year_to: { type: Number, default: null },
  },
  { softDelete: false },
);

// Was {make, model, model_code} unique globally — replaced so the SAME
// make/model/code can exist once in the shared catalog AND independently
// once per tenant's own custom catalog, without colliding.
vehicleModelSchema.index({ tenant_id: 1, make: 1, model: 1, model_code: 1 }, { unique: true });

module.exports = model("VehicleModel", vehicleModelSchema);
