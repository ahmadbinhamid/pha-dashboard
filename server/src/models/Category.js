// models/Category.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const categorySchema = buildSchema({
  // tenant_id backfilled via scripts/backfillTenantId.js; slug's unique index below is compound with it.
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
});

categorySchema.index({ tenant_id: 1, slug: 1 }, { unique: true });

module.exports = model("Category", categorySchema);
