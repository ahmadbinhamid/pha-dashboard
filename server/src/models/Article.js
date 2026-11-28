// models/Article.js
// A blog post on the storefront, at /blog/:slug.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { seoMetaSchema } = require("./schemas/seoMeta.schema");
const { toUploadRef } = require("../utils/uploadUrl");
const { CONTENT_STATUS } = require("../constants/seo.constants");

const articleSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  excerpt: { type: String, default: "", trim: true },
  // Opening lines of the body, for cards when no excerpt was typed.
  auto_excerpt: { type: String, default: "" },
  // Sanitised on save; the storefront renders it as-is.
  body_html: { type: String, default: "" },
  cover_image: { type: String, default: "", trim: true, set: toUploadRef },
  cover_alt: { type: String, default: "", trim: true },
  tags: { type: [String], default: [] },
  author_name: { type: String, default: "", trim: true },
  status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT },
  // Published with a future date reads as scheduled and stays hidden.
  published_at: { type: Date, default: null },
  reading_minutes: { type: Number, default: 1 },
  seo: { type: seoMetaSchema, default: () => ({}) },
});

articleSchema.index({ tenant_id: 1, slug: 1 }, { unique: true });
articleSchema.index({ tenant_id: 1, status: 1, published_at: -1 });
articleSchema.index({ tenant_id: 1, tags: 1, published_at: -1 });

module.exports = model("Article", articleSchema);
