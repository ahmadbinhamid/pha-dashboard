// constants/seo.constants.js
// Blog, custom pages, redirects and site-wide SEO settings.

const CONTENT_STATUS = Object.freeze({ DRAFT: "draft", PUBLISHED: "published" });

const REDIRECT_TYPE = Object.freeze({ PERMANENT: 301, TEMPORARY: 302 });

// What Google shows before truncating; longer text is allowed, just warned.
const META_LIMITS = Object.freeze({ TITLE: 60, DESCRIPTION: 160, TITLE_MAX: 120, DESCRIPTION_MAX: 320 });

const SLUG_MAX = 120;
const TAG_MAX = 40;
const MAX_TAGS = 15;
const ARTICLE_PAGE_SIZE = 12;
const RELATED_ARTICLES = 3;
// Google's per-file cap is 50,000 URLs; stay under it with headroom.
const SITEMAP_MAX_URLS = 45000;
const READING_WORDS_PER_MINUTE = 220;
const EXCERPT_LENGTH = 200;

// Storefront paths a redirect may never hijack.
const PROTECTED_PATH_PREFIXES = Object.freeze(["/cart", "/checkout", "/api", "/sitemap.xml", "/robots.txt"]);

// Built-in storefront pages whose meta the SEO team can override.
const PAGE_META_KEYS = Object.freeze(["home", "shop", "categories", "bundles", "blog"]);

module.exports = {
  CONTENT_STATUS,
  REDIRECT_TYPE,
  META_LIMITS,
  SLUG_MAX,
  TAG_MAX,
  MAX_TAGS,
  ARTICLE_PAGE_SIZE,
  RELATED_ARTICLES,
  SITEMAP_MAX_URLS,
  READING_WORDS_PER_MINUTE,
  EXCERPT_LENGTH,
  PROTECTED_PATH_PREFIXES,
  PAGE_META_KEYS,
};
