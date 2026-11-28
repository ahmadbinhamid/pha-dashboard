// validators/seo.validation.js

const Joi = require("joi");
const config = require("../config");
const {
  CONTENT_STATUS,
  REDIRECT_TYPE,
  META_LIMITS,
  SLUG_MAX,
  TAG_MAX,
  MAX_TAGS,
  PAGE_META_KEYS,
} = require("../constants/seo.constants");

const objectId = Joi.string().hex().length(24);
const byIdParam = { params: Joi.object({ id: objectId.required() }) };
// https anywhere, or a file from our own uploads (plain http in local dev).
const image = Joi.string()
  .trim()
  .max(2000)
  .custom((v, h) => (/^https:\/\/\S+$/.test(v) || v.startsWith(`${config.uploads.url}/`) ? v : h.error("any.invalid")))
  .messages({ "any.invalid": "Use an https:// image link or upload an image" });
const httpsUrl = Joi.string().trim().uri({ scheme: ["https", "http"] });

const seoMeta = Joi.object({
  meta_title: Joi.string().trim().allow("").max(META_LIMITS.TITLE_MAX),
  meta_description: Joi.string().trim().allow("").max(META_LIMITS.DESCRIPTION_MAX),
  og_image: image.allow(""),
  canonical_url: httpsUrl.allow(""),
  noindex: Joi.boolean(),
});

const slug = Joi.string().trim().allow("").max(SLUG_MAX);
const status = Joi.string().valid(...Object.values(CONTENT_STATUS));
const paging = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) };
const search = Joi.string().trim().allow("").max(100);

const articleFields = {
  title: Joi.string().trim().min(1).max(200),
  slug,
  excerpt: Joi.string().trim().allow("").max(400),
  body_html: Joi.string().allow("").max(500000),
  cover_image: image.allow(""),
  cover_alt: Joi.string().trim().allow("").max(200),
  tags: Joi.array().items(Joi.string().trim().max(TAG_MAX)).max(MAX_TAGS),
  author_name: Joi.string().trim().allow("").max(80),
  status,
  published_at: Joi.date().iso().allow(null),
  seo: seoMeta,
};

const pageFields = {
  title: Joi.string().trim().min(1).max(200),
  slug,
  body_html: Joi.string().allow("").max(500000),
  status,
  show_in_footer: Joi.boolean(),
  footer_order: Joi.number().integer().min(0).max(1000),
  seo: seoMeta,
};

// A storefront path ("/old-page") or a full https:// URL.
const redirectTarget = Joi.alternatives().try(Joi.string().trim().pattern(/^\/[^\s]*$/), httpsUrl);
const redirectFields = {
  from_path: Joi.string().trim().min(1).max(500),
  to_path: redirectTarget,
  type: Joi.number().valid(...Object.values(REDIRECT_TYPE)),
};

const pageMeta = Joi.object(
  Object.fromEntries(
    PAGE_META_KEYS.map((k) => [
      k,
      Joi.object({
        meta_title: Joi.string().trim().allow("").max(META_LIMITS.TITLE_MAX),
        meta_description: Joi.string().trim().allow("").max(META_LIMITS.DESCRIPTION_MAX),
      }),
    ]),
  ),
);

module.exports = {
  byIdParam,
  listArticles: { query: Joi.object({ ...paging, search, status, tag: Joi.string().trim().max(TAG_MAX) }) },
  createArticle: { body: Joi.object({ ...articleFields, title: articleFields.title.required() }) },
  updateArticle: { ...byIdParam, body: Joi.object(articleFields).min(1) },
  listPages: { query: Joi.object({ search, status }) },
  createPage: { body: Joi.object({ ...pageFields, title: pageFields.title.required() }) },
  updatePage: { ...byIdParam, body: Joi.object(pageFields).min(1) },
  listRedirects: { query: Joi.object({ ...paging, search }) },
  createRedirect: {
    body: Joi.object({ ...redirectFields, from_path: redirectFields.from_path.required(), to_path: redirectTarget.required() }),
  },
  updateRedirect: { ...byIdParam, body: Joi.object(redirectFields).min(1) },
  listCatalogSeo: { query: Joi.object({ ...paging, search, missing: Joi.boolean() }) },
  updateCatalogSeo: { ...byIdParam, body: seoMeta.min(1) },
  updateSettings: {
    body: Joi.object({
      site_name: Joi.string().trim().allow("").max(80),
      title_template: Joi.string().trim().max(80).pattern(/%s/).messages({ "string.pattern.base": "Include %s where the page title goes" }),
      default_description: Joi.string().trim().allow("").max(META_LIMITS.DESCRIPTION_MAX),
      default_og_image: image.allow(""),
      google_verification: Joi.string().trim().allow("").max(120),
      bing_verification: Joi.string().trim().allow("").max(120),
      social_profiles: Joi.array().items(httpsUrl).max(10),
      robots_disallow: Joi.array().items(Joi.string().trim().pattern(/^\/\S*$/).max(200)).max(50),
      page_meta: pageMeta,
    }).min(1),
  },
  publicArticles: { query: Joi.object({ page: Joi.number().integer().min(1).max(500), tag: Joi.string().trim().max(TAG_MAX) }) },
  publicSlug: { params: Joi.object({ slug: Joi.string().trim().max(SLUG_MAX).required() }) },
  publicRedirect: { query: Joi.object({ path: Joi.string().trim().max(500).required() }) },
};
