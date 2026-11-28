// services/seo/article.service.js
// Blog articles: staff CRUD, tags, and the storefront's published views.

const mongoose = require("mongoose");
const Article = require("../../models/Article");
const { createWithUniqueSlug, saveWithUniqueSlug } = require("../../utils/slug");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const { toUploadUrl } = require("../../utils/uploadUrl");
const { httpError } = require("../../utils/http/httpError");
const { sanitizeContentHtml, readingMinutes, autoExcerpt } = require("../../utils/contentHtml");
const { slugFrom, contentState, liveFilter, withSeoUrls } = require("./content-shared");
const { CONTENT_STATUS, MAX_TAGS, TAG_MAX, ARTICLE_PAGE_SIZE, RELATED_ARTICLES } = require("../../constants/seo.constants");

const EDITABLE_FIELDS = ["title", "excerpt", "body_html", "cover_image", "cover_alt", "tags", "author_name", "status", "published_at", "seo"];
const LIST_FIELDS = "-body_html";
const PUBLIC_CARD_FIELDS = "title slug excerpt auto_excerpt cover_image cover_alt tags author_name published_at reading_minutes";

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/** Trimmed, de-duplicated (case-insensitive) and capped tags. */
function normalizeTags(tags = []) {
  const seen = new Map();
  for (const raw of tags) {
    const tag = String(raw || "").trim().slice(0, TAG_MAX);
    if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  }
  return [...seen.values()].slice(0, MAX_TAGS);
}

const present = (doc) => ({
  ...doc,
  cover_image: toUploadUrl(doc.cover_image) || "",
  seo: withSeoUrls(doc.seo),
  state: contentState(doc),
});

/** Body-derived fields, plus a publish date the first time it goes live. */
function deriveFields(fields, current = {}) {
  const next = { ...fields };
  if (next.body_html !== undefined) {
    next.body_html = sanitizeContentHtml(next.body_html);
    next.reading_minutes = readingMinutes(next.body_html);
    next.auto_excerpt = autoExcerpt(next.body_html);
  }
  if (next.tags !== undefined) next.tags = normalizeTags(next.tags);
  const status = next.status ?? current.status;
  if (status === CONTENT_STATUS.PUBLISHED && !(next.published_at ?? current.published_at)) next.published_at = new Date();
  return next;
}

const pickEditable = (input) => Object.fromEntries(EDITABLE_FIELDS.filter((f) => input[f] !== undefined).map((f) => [f, input[f]]));

async function findArticle(id, tenantId) {
  const article = await Article.findOne({ _id: id, tenant_id: tenantId });
  if (!article) throw httpError("Article not found", 404);
  return article;
}

async function listArticles(tenantId, { skip = 0, limit = 20, search, status, tag } = {}) {
  const filter = { tenant_id: tenantId };
  if (status) filter.status = status;
  if (tag) filter.tags = tag;
  const words = buildAllWordsSearchAnd(["title", "slug", "tags"], search);
  if (words.length) filter.$and = words;
  const [items, total] = await Promise.all([
    Article.find(filter).select(LIST_FIELDS).sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    Article.countDocuments(filter),
  ]);
  return { items: items.map(present), total };
}

async function getArticle(id, tenantId) {
  return present((await findArticle(id, tenantId)).toObject());
}

async function createArticle(tenantId, input) {
  const fields = deriveFields(pickEditable(input));
  const created = await createWithUniqueSlug(Article, slugFrom(input.slug, input.title), (slug) => ({ ...fields, slug, tenant_id: tenantId }), {
    tenantId,
  });
  return getArticle(created._id, tenantId);
}

async function updateArticle(id, tenantId, patch) {
  const article = await findArticle(id, tenantId);
  article.set(deriveFields(pickEditable(patch), article.toObject()));
  const wantsSlug = patch.slug !== undefined && slugFrom(patch.slug, article.title) !== article.slug;
  if (wantsSlug) await saveWithUniqueSlug(article, Article, slugFrom(patch.slug, article.title), article._id, { tenantId });
  else await article.save();
  return getArticle(id, tenantId);
}

async function deleteArticle(id, tenantId) {
  const article = await findArticle(id, tenantId);
  await article.softDelete();
  return { _id: article._id };
}

/** Every tag in use with its article count, most used first. */
async function listTags(tenantId, { publishedOnly = false } = {}) {
  const match = publishedOnly ? liveFilter(toObjectId(tenantId)) : { tenant_id: toObjectId(tenantId) };
  const rows = await Article.aggregate([
    { $match: match },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((r) => ({ tag: r._id, count: r.count }));
}

async function countArticlesByState(tenantId, now = new Date()) {
  const published = { $eq: ["$status", CONTENT_STATUS.PUBLISHED] };
  const future = { $gt: ["$published_at", now] };
  const [row] = await Article.aggregate([
    { $match: { tenant_id: toObjectId(tenantId) } },
    {
      $group: {
        _id: null,
        draft: { $sum: { $cond: [published, 0, 1] } },
        scheduled: { $sum: { $cond: [{ $and: [published, future] }, 1, 0] } },
        published: { $sum: { $cond: [{ $and: [published, { $not: [future] }] }, 1, 0] } },
      },
    },
  ]);
  return { draft: row?.draft ?? 0, scheduled: row?.scheduled ?? 0, published: row?.published ?? 0 };
}

// ── storefront ──

const presentCard = ({ auto_excerpt: auto, ...doc }) => ({
  ...doc,
  cover_image: toUploadUrl(doc.cover_image) || "",
  excerpt: doc.excerpt || auto || "",
});

async function listPublishedArticles(tenantId, { page = 1, tag } = {}) {
  const filter = { ...liveFilter(tenantId), ...(tag && { tags: tag }) };
  const skip = (page - 1) * ARTICLE_PAGE_SIZE;
  const [items, total] = await Promise.all([
    Article.find(filter).select(PUBLIC_CARD_FIELDS).sort({ published_at: -1 }).skip(skip).limit(ARTICLE_PAGE_SIZE).lean(),
    Article.countDocuments(filter),
  ]);
  return { items: items.map(presentCard), total, page, totalPages: Math.max(Math.ceil(total / ARTICLE_PAGE_SIZE), 1) };
}

/** One live article plus a few related by shared tags, newest first. */
async function getPublishedArticle(tenantId, slug) {
  const article = await Article.findOne({ ...liveFilter(tenantId), slug }).lean();
  if (!article) throw httpError("Article not found", 404);
  const related = article.tags.length
    ? await Article.find({ ...liveFilter(tenantId), _id: { $ne: article._id }, tags: { $in: article.tags } })
        .select(PUBLIC_CARD_FIELDS)
        .sort({ published_at: -1 })
        .limit(RELATED_ARTICLES)
        .lean()
    : [];
  const excerpt = article.excerpt || autoExcerpt(article.body_html);
  return { ...present(article), excerpt, related: related.map(presentCard) };
}

/** Live article slugs for the sitemap, noindex ones left out. */
function cursorSitemapArticles(tenantId) {
  return Article.find({ ...liveFilter(tenantId), "seo.noindex": { $ne: true } }).select("slug updated_at").lean().cursor();
}

module.exports = {
  normalizeTags,
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  listTags,
  countArticlesByState,
  listPublishedArticles,
  getPublishedArticle,
  cursorSitemapArticles,
};
