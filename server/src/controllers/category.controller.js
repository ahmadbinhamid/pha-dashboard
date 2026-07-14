// controllers/category.controller.js

const categoryService = require("../services/category.service");
const {
  success,
  created,
  notFound,
  requestConflict,
  systemfailure,
} = require("../utils/http/response");

exports.getCategories = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const { items, total } = await categoryService.listCategories({ skip, limit });

    return success(res, {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCategory = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    if (!category) return notFound(res, "Category not found");
    return success(res, category);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.body);
    return created(res, category, "Category created");
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, "Category slug already exists");
    return systemfailure(res, err);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    if (!category) return notFound(res, "Category not found");
    return success(res, category, "Category updated");
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, "Category slug already exists");
    return systemfailure(res, err);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await categoryService.deleteCategory(req.params.id);
    if (!category) return notFound(res, "Category not found");
    return success(res, null, "Category deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
