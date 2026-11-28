// services/seo/catalog-seo.service.js
// Search and social overrides for products and categories.

const Product = require("../../models/Product");
const Category = require("../../models/Category");
const { httpError } = require("../../utils/http/httpError");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const { withAttachmentUrls } = require("../../utils/attachment");
const { withSeoUrls } = require("./content-shared");
const { plainText } = require("../../utils/contentHtml");
const { PRODUCT_STATUS } = require("../../constants/product.constants");

const SEO_FIELDS = ["meta_title", "meta_description", "og_image", "canonical_url", "noindex"];
// No own meta description: the storefront falls back to the product text.
const MISSING_DESCRIPTION = { $or: [{ "seo.meta_description": { $in: ["", null] } }, { seo: { $exists: false } }] };

const publicProductFilter = (tenantId) => ({ tenant_id: tenantId, is_published_online: true, status: PRODUCT_STATUS.ACTIVE });

/** Dot-path $set for only the SEO fields given. */
const seoSet = (seo) => Object.fromEntries(SEO_FIELDS.filter((f) => seo[f] !== undefined).map((f) => [`seo.${f}`, seo[f]]));

function listFilter(tenantId, { search, missing }, searchFields) {
  const filter = { tenant_id: tenantId };
  const words = buildAllWordsSearchAnd(searchFields, search);
  const and = [...words, ...(missing ? [MISSING_DESCRIPTION] : [])];
  if (and.length) filter.$and = and;
  return filter;
}

async function listProductSeo(tenantId, { skip = 0, limit = 25, ...filters } = {}) {
  const filter = { ...listFilter(tenantId, filters, ["title", "slug", "sku"]), is_published_online: true };
  const [items, total] = await Promise.all([
    Product.find(filter)
      .select("title slug description seo attachments")
      .populate("attachments", "file_name")
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return {
    items: items.map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      image: withAttachmentUrls(p.attachments)?.[0]?.url ?? null,
      // What the storefront falls back to when no search description is set.
      description_text: plainText(p.description).slice(0, 320),
      seo: withSeoUrls(p.seo),
    })),
    total,
  };
}

async function updateProductSeo(id, tenantId, seo) {
  const updated = await Product.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { $set: seoSet(seo) }, { new: true, runValidators: true })
    .select("title slug seo")
    .lean();
  if (!updated) throw httpError("Product not found", 404);
  return { ...updated, seo: withSeoUrls(updated.seo) };
}

async function listCategorySeo(tenantId, { skip = 0, limit = 25, ...filters } = {}) {
  const filter = listFilter(tenantId, filters, ["name", "slug"]);
  const [items, total] = await Promise.all([
    Category.find(filter).select("name slug description seo").sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);
  return { items: items.map((c) => ({ ...c, seo: withSeoUrls(c.seo) })), total };
}

async function updateCategorySeo(id, tenantId, seo) {
  const updated = await Category.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { $set: seoSet(seo) }, { new: true, runValidators: true })
    .select("name slug seo")
    .lean();
  if (!updated) throw httpError("Category not found", 404);
  return { ...updated, seo: withSeoUrls(updated.seo) };
}

async function countProductsMissingDescription(tenantId) {
  return Product.countDocuments({ ...publicProductFilter(tenantId), ...MISSING_DESCRIPTION });
}

function cursorSitemapProducts(tenantId) {
  return Product.find({ ...publicProductFilter(tenantId), "seo.noindex": { $ne: true } }).select("slug updated_at").lean().cursor();
}

function cursorSitemapCategories(tenantId) {
  return Category.find({ tenant_id: tenantId, "seo.noindex": { $ne: true } }).select("slug updated_at").lean().cursor();
}

module.exports = {
  listProductSeo,
  updateProductSeo,
  listCategorySeo,
  updateCategorySeo,
  countProductsMissingDescription,
  cursorSitemapProducts,
  cursorSitemapCategories,
};
