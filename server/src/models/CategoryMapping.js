// models/CategoryMapping.js
// Tenant's default channel category per product category (taxonomies can't be derived).

const { Schema, model } = require("mongoose");
const { buildSchema } = require("./base.model");

const categoryMappingSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    product_category_id: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    platform: { type: String, required: true },
    external_category_id: { type: String, required: true, trim: true },
    external_category_name: { type: String, default: null, trim: true },
  },
  // Hard delete so a removed mapping frees its unique slot.
  { softDelete: false },
);

categoryMappingSchema.index({ tenant_id: 1, product_category_id: 1, platform: 1 }, { unique: true });

module.exports = model("CategoryMapping", categoryMappingSchema);
