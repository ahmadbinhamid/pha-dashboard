// services/seo/content-shared.js
// Helpers shared by the article and page services: slugs, SEO, state.

const { generateSlug } = require("../../utils/slug");
const { toUploadUrl } = require("../../utils/uploadUrl");
const { CONTENT_STATUS, SLUG_MAX } = require("../../constants/seo.constants");

const CONTENT_STATE = Object.freeze({ DRAFT: "draft", SCHEDULED: "scheduled", PUBLISHED: "published" });

/** URL-safe slug from the given one, else the title. */
function slugFrom(input, title) {
  return (generateSlug(input || title || "") || "untitled").slice(0, SLUG_MAX).replace(/-+$/, "");
}

/** Derived state: published with a future date reads as scheduled. */
function contentState(doc, now = new Date()) {
  if (doc.status !== CONTENT_STATUS.PUBLISHED) return CONTENT_STATE.DRAFT;
  return doc.published_at && new Date(doc.published_at) > now ? CONTENT_STATE.SCHEDULED : CONTENT_STATE.PUBLISHED;
}

/** Query form of "live on the storefront right now". */
const liveFilter = (tenantId, now = new Date()) => ({
  tenant_id: tenantId,
  status: CONTENT_STATUS.PUBLISHED,
  published_at: { $lte: now },
});

const withSeoUrls = (seo = {}) => ({ ...seo, og_image: toUploadUrl(seo.og_image) || "" });

module.exports = { CONTENT_STATE, slugFrom, contentState, liveFilter, withSeoUrls };
