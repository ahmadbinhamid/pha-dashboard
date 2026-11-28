// models/Category.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { seoMetaSchema } = require("./schemas/seoMeta.schema");

const categorySchema = buildSchema({
  // Backfilled by scripts/backfillTenantId.js; the slug index includes it.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String },
  description: { type: String, default: "" },
  thumbnail: {
    type: Schema.Types.ObjectId,
    ref: "Attachment",
    default: null,
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  sort_order: { type: Number, default: 0 },
  seo: { type: seoMetaSchema, default: () => ({}) },
});

categorySchema.index({ tenant_id: 1, slug: 1 }, { unique: true });

module.exports = model("Category", categorySchema);
