// models/SeoSettings.js
// Site-wide SEO for one storefront: defaults, verification and robots.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { toUploadRef } = require("../utils/uploadUrl");
const { PAGE_META_KEYS } = require("../constants/seo.constants");

const pageMetaSchema = new Schema(
  {
    meta_title: { type: String, default: "", trim: true },
    meta_description: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const seoSettingsSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    site_name: { type: String, default: "", trim: true },
    // "%s" is replaced by the page's own title, e.g. "%s | Parts Hub".
    title_template: { type: String, default: "%s", trim: true },
    default_description: { type: String, default: "", trim: true },
    default_og_image: { type: String, default: "", trim: true, set: toUploadRef },
    google_verification: { type: String, default: "", trim: true },
    bing_verification: { type: String, default: "", trim: true },
    // schema.org Organization sameAs: the store's social profiles.
    social_profiles: { type: [String], default: [] },
    // Extra "Disallow:" paths appended to robots.txt.
    robots_disallow: { type: [String], default: [] },
    page_meta: {
      type: new Schema(Object.fromEntries(PAGE_META_KEYS.map((k) => [k, { type: pageMetaSchema, default: () => ({}) }])), {
        _id: false,
      }),
      default: () => ({}),
    },
  },
  { softDelete: false },
);

module.exports = model("SeoSettings", seoSettingsSchema);
