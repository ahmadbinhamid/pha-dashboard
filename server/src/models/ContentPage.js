// models/ContentPage.js
// A custom storefront page (About, FAQ, Warranty…), at /pages/:slug.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { seoMetaSchema } = require("./schemas/seoMeta.schema");
const { CONTENT_STATUS } = require("../constants/seo.constants");

const contentPageSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  // Sanitised on save; the storefront renders it as-is.
  body_html: { type: String, default: "" },
  status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT },
  show_in_footer: { type: Boolean, default: false },
  footer_order: { type: Number, default: 0 },
  seo: { type: seoMetaSchema, default: () => ({}) },
});

contentPageSchema.index({ tenant_id: 1, slug: 1 }, { unique: true });

module.exports = model("ContentPage", contentPageSchema);
