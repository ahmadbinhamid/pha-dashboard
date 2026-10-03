// services/category.service.js

const Category = require("../models/Category");
const Product = require("../models/Product");
const Attachment = require("../models/Attachment");
const {
  generateSlug,
  createWithUniqueSlug,
  saveWithUniqueSlug,
} = require("../utils/slug");
const { PRODUCT_STATUS } = require("../constants/product.constants");
const { buildProductFilter } = require("../utils/productFilter");

// Counts storefront-visible products only, scoped by the active shop filters.
async function getProductCountsByCategory(categoryIds, extraFilter = {}) {
  if (!categoryIds.length) return new Map();

  const counts = await Product.aggregate([
    {
      $match: {
        ...extraFilter,
        categories: { $in: categoryIds },
        is_published_online: true,
        status: PRODUCT_STATUS.ACTIVE,
      },
    },
    { $unwind: "$categories" },
    { $match: { categories: { $in: categoryIds } } },
    { $group: { _id: "$categories", count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((c) => [c._id.toString(), c.count]));
}

async function listCategories({ skip = 0, limit = 0, productFilters = {}, slugs = [] } = {}, tenantId) {
  const filter = { tenant_id: tenantId };
  if (slugs.length) filter.slug = { $in: slugs };
  const [items, total] = await Promise.all([
    Category.find(filter)
      .populate("thumbnail")
      .sort({ sort_order: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  // getProductCountsByCategory applies category/publish/active filters itself.
  const countFilter = buildProductFilter(productFilters, { authenticated: false, tenantId });
  delete countFilter.categories;
  delete countFilter.is_published_online;
  delete countFilter.status;

  const countMap = await getProductCountsByCategory(items.map((c) => c._id), countFilter);
  const withCounts = items.map((c) => ({
    ...c.toObject(),
    product_count: countMap.get(c._id.toString()) || 0,
  }));

  return { items: withCounts, total };
}

// Lean id/name/parent list for pickers (no counts, no populate).
async function listCategoryOptions(tenantId) {
  return Category.find({ tenant_id: tenantId }).select("name parent sort_order").sort({ sort_order: 1, name: 1 }).lean();
}

async function getCategoryById(id, tenantId) {
  return Category.findOne({ _id: id, tenant_id: tenantId }).populate("parent").populate("thumbnail");
}

// Parent/thumbnail ids must belong to this tenant: no cross-tenant links.
async function verifyReferenceOwnership({ parent, thumbnail }, tenantId) {
  const checks = [];
  if (parent) checks.push(Category.exists({ _id: parent, tenant_id: tenantId }).then((ok) => ({ field: "parent", ok })));
  if (thumbnail) checks.push(Attachment.exists({ _id: thumbnail, tenant_id: tenantId }).then((ok) => ({ field: "thumbnail", ok })));
  const results = await Promise.all(checks);
  const invalid = results.find((r) => !r.ok);
  if (invalid) throw Object.assign(new Error(`Invalid ${invalid.field}`), { status: 400 });
}

async function createCategory({ name, description, thumbnail, parent, sort_order }, tenantId) {
  await verifyReferenceOwnership({ parent, thumbnail }, tenantId);

  const baseSlug = generateSlug(name);
  // Race-safe: retries on slug conflict instead of check-then-insert.
  return createWithUniqueSlug(
    Category,
    baseSlug,
    (slug) => ({
      tenant_id: tenantId,
      name,
      slug,
      description: description || "",
      thumbnail: thumbnail || null,
      parent: parent || null,
      sort_order: sort_order || 0,
    }),
    { tenantId },
  );
}

async function updateCategory(id, { name, description, thumbnail, parent, sort_order, slug: slugOverride }, tenantId) {
  const category = await Category.findOne({ _id: id, tenant_id: tenantId });
  if (!category) return null;

  await verifyReferenceOwnership({ parent, thumbnail }, tenantId);

  let pendingSlugBase = null;
  if (name && name !== category.name) {
    pendingSlugBase = slugOverride ? generateSlug(slugOverride) : generateSlug(name);
    category.name = name;
  } else if (slugOverride) {
    pendingSlugBase = generateSlug(slugOverride);
  }

  if (description !== undefined) category.description = description;
  if (thumbnail !== undefined) category.thumbnail = thumbnail || null;
  if (parent !== undefined) category.parent = parent || null;
  if (sort_order !== undefined) category.sort_order = sort_order;

  // Race-safe: retries on slug conflict instead of check-then-save.
  if (pendingSlugBase) {
    await saveWithUniqueSlug(category, Category, pendingSlugBase, category._id.toString(), { tenantId });
  } else {
    await category.save();
  }
  return category;
}

async function deleteCategory(id, tenantId) {
  const category = await Category.findOne({ _id: id, tenant_id: tenantId });
  if (!category) return null;
  await category.softDelete();
  return category;
}

module.exports = { listCategories, listCategoryOptions, getCategoryById, createCategory, updateCategory, deleteCategory };
