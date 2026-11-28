// models/schemas/seoMeta.schema.js
// Per-document search and social overrides; blanks fall back to defaults.

const { Schema } = require("mongoose");
const { toUploadRef } = require("../../utils/uploadUrl");

const seoMetaSchema = new Schema(
  {
    meta_title: { type: String, default: "", trim: true },
    meta_description: { type: String, default: "", trim: true },
    og_image: { type: String, default: "", trim: true, set: toUploadRef },
    canonical_url: { type: String, default: "", trim: true },
    // Asks search engines to skip the page and leaves it out of the sitemap.
    noindex: { type: Boolean, default: false },
  },
  { _id: false },
);

module.exports = { seoMetaSchema };
