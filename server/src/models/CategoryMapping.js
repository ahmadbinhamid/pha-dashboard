// models/CategoryMapping.js
// A tenant's default channel category for one of its product categories, e.g. "Brake Discs"
// -> eBay 33564 / Google 2977. Channel taxonomies are unrelated, so this can't be derived.
// Used when a listing has no category of its own (see categoryMapping.service.js).

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
  // Hard delete: removing a mapping must free its unique slot.
  { softDelete: false },
);

categoryMappingSchema.index({ tenant_id: 1, product_category_id: 1, platform: 1 }, { unique: true });

module.exports = model("CategoryMapping", categoryMappingSchema);
