// services/category.service.js

const Category = require("../models/Category");
const Product = require("../models/Product");
const {
  generateSlug,
  createWithUniqueSlug,
  saveWithUniqueSlug,
} = require("../utils/slug");
const { escapeRegex } = require("../utils/regex");
const { PRODUCT_STATUS } = require("../constants/product.constants");

// Product counts reflect only what a storefront shopper could ever find
// (published + active) — not the raw/admin-visible product count.
async function getProductCountsByCategory(categoryIds) {
  if (!categoryIds.length) return new Map();

  const counts = await Product.aggregate([
    {
      $match: {
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

async function listCategories({ skip = 0, limit = 0, search = "" } = {}) {
  const filter = {};
  if (search) {
    filter.name = new RegExp(escapeRegex(search.trim()), "i");
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .populate("thumbnail")
      .sort({ sort_order: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  const countMap = await getProductCountsByCategory(items.map((c) => c._id));
  const withCounts = items.map((c) => ({
    ...c.toObject(),
    product_count: countMap.get(c._id.toString()) || 0,
  }));

  return { items: withCounts, total };
}

async function getCategoryById(id) {
  return Category.findById(id).populate("parent").populate("thumbnail");
}

async function createCategory({ name, description, thumbnail, parent, sort_order }) {
  const baseSlug = generateSlug(name);
  // Race-safe: retries on a genuine slug conflict instead of trusting a
  // single check-then-insert (see utils/slug.js for why).
  return createWithUniqueSlug(Category, baseSlug, (slug) => ({
    name,
    slug,
    description: description || "",
    thumbnail: thumbnail || null,
    parent: parent || null,
    sort_order: sort_order || 0,
  }));
}

async function updateCategory(id, { name, description, thumbnail, parent, sort_order, slug: slugOverride }) {
  const category = await Category.findById(id);
  if (!category) return null;

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

  // Race-safe: retries on a genuine slug conflict instead of trusting a
  // single check-then-save (see utils/slug.js for why).
  if (pendingSlugBase) {
    await saveWithUniqueSlug(category, Category, pendingSlugBase, category._id.toString());
  } else {
    await category.save();
  }
  return category;
}

async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) return null;
  await category.softDelete();
  return category;
}

module.exports = { listCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
