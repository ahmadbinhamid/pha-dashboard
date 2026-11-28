// services/seo/seo-settings.service.js
// Site-wide SEO settings, the dashboard overview and the sitemap feed.

const SeoSettings = require("../../models/SeoSettings");
const { getCompanyProfile } = require("../tenant-settings.service");
const { getDefaultStorefrontHost } = require("../domain.service");
const config = require("../../config");
const { toUploadUrl } = require("../../utils/uploadUrl");
const articleService = require("./article.service");
const pageService = require("./page.service");
const redirectService = require("./redirect.service");
const catalogSeo = require("./catalog-seo.service");
const { SITEMAP_MAX_URLS, PAGE_META_KEYS } = require("../../constants/seo.constants");

const EDITABLE_FIELDS = [
  "site_name",
  "title_template",
  "default_description",
  "default_og_image",
  "google_verification",
  "bing_verification",
  "social_profiles",
  "robots_disallow",
  "page_meta",
];

// Schema defaults, built once; unsaved tenants read as these.
const BLANK = new SeoSettings().toObject();

async function presentSettings(tenantId, doc) {
  const merged = { ...BLANK, ...doc };
  const pageMeta = Object.fromEntries(PAGE_META_KEYS.map((k) => [k, { ...BLANK.page_meta[k], ...merged.page_meta?.[k] }]));
  const [profile, host] = await Promise.all([getCompanyProfile(tenantId), getDefaultStorefrontHost(tenantId)]);
  // A blank site name borrows the trading name, so new stores read right.
  const siteName = merged.site_name || profile.company_name || "";
  return {
    ...Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, merged[f]])),
    site_name: siteName,
    default_og_image: toUploadUrl(merged.default_og_image) || "",
    page_meta: pageMeta,
    // Read-only: where "View on site" links and search previews point.
    storefront_url: host ? `https://${host}` : config.emailBrand.storefrontUrl,
    updated_at: doc?.updated_at ?? null,
  };
}

async function getSeoSettings(tenantId) {
  return presentSettings(tenantId, await SeoSettings.findOne({ tenant_id: tenantId }).lean());
}

async function updateSeoSettings(tenantId, patch) {
  const $set = Object.fromEntries(EDITABLE_FIELDS.filter((f) => patch[f] !== undefined).map((f) => [f, patch[f]]));
  const doc = await SeoSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $set, $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, runValidators: true },
  ).lean();
  return presentSettings(tenantId, doc);
}

/** The storefront's view: settings plus the footer's page links. */
async function getPublicSeo(tenantId) {
  const [settings, footerPages] = await Promise.all([getSeoSettings(tenantId), pageService.listFooterPages(tenantId)]);
  return { ...settings, footer_pages: footerPages };
}

async function getSeoOverview(tenantId) {
  const [articles, pages, redirects, productsMissingDescription] = await Promise.all([
    articleService.countArticlesByState(tenantId),
    pageService.countPagesByStatus(tenantId),
    redirectService.countRedirects(tenantId),
    catalogSeo.countProductsMissingDescription(tenantId),
  ]);
  return { articles, pages, redirects, products_missing_description: productsMissingDescription };
}

/** Drains a cursor of {slug, updated_at} up to the shared URL budget. */
async function collect(cursor, budget) {
  const rows = [];
  for await (const doc of cursor) {
    if (budget.left <= 0) break;
    rows.push({ id: String(doc._id), slug: doc.slug, updated_at: doc.updated_at ?? null });
    budget.left -= 1;
  }
  await cursor.close();
  return rows;
}

/** Every indexable slug, by type; the storefront renders the XML. */
async function getSitemapEntries(tenantId) {
  const budget = { left: SITEMAP_MAX_URLS };
  const categories = await collect(catalogSeo.cursorSitemapCategories(tenantId), budget);
  const pages = await collect(pageService.cursorSitemapPages(tenantId), budget);
  const articles = await collect(articleService.cursorSitemapArticles(tenantId), budget);
  const products = await collect(catalogSeo.cursorSitemapProducts(tenantId), budget);
  return { categories, pages, articles, products, truncated: budget.left <= 0 };
}

module.exports = { getSeoSettings, updateSeoSettings, getPublicSeo, getSeoOverview, getSitemapEntries };
