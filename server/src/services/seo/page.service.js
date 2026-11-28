// services/seo/page.service.js
// Custom storefront pages: staff CRUD, the footer list and public reads.

const ContentPage = require("../../models/ContentPage");
const { createWithUniqueSlug, saveWithUniqueSlug } = require("../../utils/slug");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const { httpError } = require("../../utils/http/httpError");
const { sanitizeContentHtml, autoExcerpt } = require("../../utils/contentHtml");
const { slugFrom, withSeoUrls } = require("./content-shared");
const { CONTENT_STATUS } = require("../../constants/seo.constants");

const EDITABLE_FIELDS = ["title", "body_html", "status", "show_in_footer", "footer_order", "seo"];

const present = (doc) => ({ ...doc, seo: withSeoUrls(doc.seo) });

const pickEditable = (input) => {
  const fields = Object.fromEntries(EDITABLE_FIELDS.filter((f) => input[f] !== undefined).map((f) => [f, input[f]]));
  if (fields.body_html !== undefined) fields.body_html = sanitizeContentHtml(fields.body_html);
  return fields;
};

const publishedFilter = (tenantId) => ({ tenant_id: tenantId, status: CONTENT_STATUS.PUBLISHED });

async function findPage(id, tenantId) {
  const page = await ContentPage.findOne({ _id: id, tenant_id: tenantId });
  if (!page) throw httpError("Page not found", 404);
  return page;
}

async function listPages(tenantId, { search, status } = {}) {
  const filter = { tenant_id: tenantId };
  if (status) filter.status = status;
  const words = buildAllWordsSearchAnd(["title", "slug"], search);
  if (words.length) filter.$and = words;
  const items = await ContentPage.find(filter).select("-body_html").sort({ footer_order: 1, title: 1 }).lean();
  return items.map(present);
}

async function getPage(id, tenantId) {
  return present((await findPage(id, tenantId)).toObject());
}

async function createPage(tenantId, input) {
  const fields = pickEditable(input);
  const created = await createWithUniqueSlug(ContentPage, slugFrom(input.slug, input.title), (slug) => ({ ...fields, slug, tenant_id: tenantId }), {
    tenantId,
  });
  return getPage(created._id, tenantId);
}

async function updatePage(id, tenantId, patch) {
  const page = await findPage(id, tenantId);
  page.set(pickEditable(patch));
  const nextSlug = patch.slug !== undefined ? slugFrom(patch.slug, page.title) : page.slug;
  if (nextSlug !== page.slug) await saveWithUniqueSlug(page, ContentPage, nextSlug, page._id, { tenantId });
  else await page.save();
  return getPage(id, tenantId);
}

async function deletePage(id, tenantId) {
  const page = await findPage(id, tenantId);
  await page.softDelete();
  return { _id: page._id };
}

async function countPagesByStatus(tenantId) {
  const [published, total] = await Promise.all([
    ContentPage.countDocuments(publishedFilter(tenantId)),
    ContentPage.countDocuments({ tenant_id: tenantId }),
  ]);
  return { published, draft: total - published };
}

// ── storefront ──

/** Published pages flagged for the footer, in their set order. */
async function listFooterPages(tenantId) {
  return ContentPage.find({ ...publishedFilter(tenantId), show_in_footer: true })
    .select("title slug")
    .sort({ footer_order: 1, title: 1 })
    .lean();
}

async function getPublishedPage(tenantId, slug) {
  const page = await ContentPage.findOne({ ...publishedFilter(tenantId), slug }).lean();
  if (!page) throw httpError("Page not found", 404);
  return { ...present(page), excerpt: autoExcerpt(page.body_html) };
}

function cursorSitemapPages(tenantId) {
  return ContentPage.find({ ...publishedFilter(tenantId), "seo.noindex": { $ne: true } }).select("slug updated_at").lean().cursor();
}

module.exports = {
  listPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  countPagesByStatus,
  listFooterPages,
  getPublishedPage,
  cursorSitemapPages,
};
