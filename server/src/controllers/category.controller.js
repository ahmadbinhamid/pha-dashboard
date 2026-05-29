// controllers/category.controller.js

const Category = require("../models/Category");
const { generateSlug, ensureUniqueSlug } = require("../utils/slug");
const {
  success,
  created,
  notFound,
  requestConflict,
  systemfailure,
} = require("../utils/http/response");

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ sort_order: 1, name: 1 });
    return success(res, categories);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate("parent");
    if (!category) return notFound(res, "Category not found");
    return success(res, category);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, parent, sort_order } = req.body;

    const baseSlug = generateSlug(name);
    const slug = await ensureUniqueSlug(Category, baseSlug);

    const category = await Category.create({
      name,
      slug,
      parent: parent || null,
      sort_order: sort_order || 0,
    });

    return created(res, category, "Category created");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Category slug already exists");
    return systemfailure(res, err);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res, "Category not found");

    const { name, parent, sort_order, slug: slugOverride } = req.body;

    if (name && name !== category.name) {
      const baseSlug = slugOverride
        ? generateSlug(slugOverride)
        : generateSlug(name);
      category.slug = await ensureUniqueSlug(
        Category,
        baseSlug,
        category._id.toString(),
      );
      category.name = name;
    } else if (slugOverride) {
      category.slug = await ensureUniqueSlug(
        Category,
        generateSlug(slugOverride),
        category._id.toString(),
      );
    }

    if (parent !== undefined) category.parent = parent || null;
    if (sort_order !== undefined) category.sort_order = sort_order;

    await category.save();
    return success(res, category, "Category updated");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Category slug already exists");
    return systemfailure(res, err);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res, "Category not found");

    await category.softDelete();
    return success(res, null, "Category deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
