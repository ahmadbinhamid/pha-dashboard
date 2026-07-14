// services/category.service.js

const Category = require("../models/Category");
const { generateSlug, ensureUniqueSlug } = require("../utils/slug");

async function listCategories({ skip = 0, limit = 0 } = {}) {
  const [items, total] = await Promise.all([
    Category.find({})
      .populate("thumbnail")
      .sort({ sort_order: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    Category.countDocuments({}),
  ]);
  return { items, total };
}

async function getCategoryById(id) {
  return Category.findById(id).populate("parent").populate("thumbnail");
}

async function createCategory({ name, description, thumbnail, parent, sort_order }) {
  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(Category, baseSlug);
  return Category.create({
    name,
    slug,
    description: description || "",
    thumbnail: thumbnail || null,
    parent: parent || null,
    sort_order: sort_order || 0,
  });
}

async function updateCategory(id, { name, description, thumbnail, parent, sort_order, slug: slugOverride }) {
  const category = await Category.findById(id);
  if (!category) return null;

  if (name && name !== category.name) {
    const baseSlug = slugOverride ? generateSlug(slugOverride) : generateSlug(name);
    category.slug = await ensureUniqueSlug(Category, baseSlug, category._id.toString());
    category.name = name;
  } else if (slugOverride) {
    category.slug = await ensureUniqueSlug(
      Category,
      generateSlug(slugOverride),
      category._id.toString(),
    );
  }

  if (description !== undefined) category.description = description;
  if (thumbnail !== undefined) category.thumbnail = thumbnail || null;
  if (parent !== undefined) category.parent = parent || null;
  if (sort_order !== undefined) category.sort_order = sort_order;

  await category.save();
  return category;
}

async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) return null;
  await category.softDelete();
  return category;
}

module.exports = { listCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
