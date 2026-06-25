// services/product.service.js

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const Location = require("../models/Location");
const MarketplaceListing = require("../models/MarketplaceListing");
const { ensureUniqueSlug } = require("../utils/slug");
const { logger } = require("../loaders/logging");

// ── Variant generation ────────────────────────────────────────────────────────

function cartesian(arrays) {
  if (!arrays || arrays.length === 0) return [[]];
  return arrays.reduce(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
  );
}

async function generateVariantsForProduct(product) {
  if (!product.choices || product.choices.length === 0) return [];

  const optionNames = product.choices.map((c) => c.name);
  const optionValues = product.choices.map((c) => c.items || []);

  const combinations = cartesian(optionValues);
  const existingVariants = await ProductVariant.find({ product: product._id });
  const newVariants = [];

  for (const combo of combinations) {
    const combination = optionNames.map((name, i) => ({
      option: name,
      value: combo[i] || "",
    }));

    const display_name = combo.join(" / ");

    const alreadyExists = existingVariants.find((v) => {
      if (v.combination.length !== combination.length) return false;
      return v.combination.every(
        (c, i) =>
          c.option === combination[i].option &&
          c.value === combination[i].value,
      );
    });

    if (!alreadyExists) {
      const variant = await ProductVariant.create({
        product: product._id,
        combination,
        display_name,
        price: product.price || 0,
        compare_price: product.compare_price || null,
        cost_price: product.cost_price || null,
      });
      newVariants.push(variant);
    }
  }

  return newVariants;
}

async function ensureInventoryForProduct(productId, variantId = null) {
  const locations = await Location.find({ is_active: true });
  if (!locations.length) return;

  for (const loc of locations) {
    await Inventory.findOneAndUpdate(
      { product: productId, variant: variantId, location: loc._id },
      {
        $setOnInsert: {
          product: productId,
          variant: variantId,
          location: loc._id,
        },
      },
      { upsert: true, new: true },
    );
  }
}

// ── Product CRUD ──────────────────────────────────────────────────────────────

function withBasePopulate(query) {
  return query
    .populate("attachments", "url original_name mime_type type uid file_name")
    .populate("categories", "name slug");
}

async function getProducts(filter, { skip, limit }) {
  const [items, total] = await Promise.all([
    withBasePopulate(Product.find(filter))
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, total };
}

async function findProductById(id) {
  return Product.findById(id);
}

async function findProductWithAttachments(id) {
  return Product.findById(id).populate("attachments").lean();
}

async function getProductBySlug(slug) {
  return Product.findOne({ slug })
    .populate("attachments")
    .populate("categories")
    .populate("digital_file")
    .populate("related_products", "title slug price attachments");
}

async function getPopulatedProduct(id) {
  return Product.findById(id)
    .populate("attachments")
    .populate("categories")
    .populate("digital_file");
}

async function createProductRecord(data) {
  return Product.create(data);
}

async function ensureUniqueProductSlug(baseSlug, excludeId = null) {
  return ensureUniqueSlug(Product, baseSlug, excludeId);
}

// ── Variant CRUD ──────────────────────────────────────────────────────────────

async function findVariantsByProductId(productId) {
  return ProductVariant.find({ product: productId });
}

async function getVariantsByProduct(productId) {
  return ProductVariant.find({ product: productId })
    .populate("attachments")
    .populate("digital_file")
    .sort({ display_name: 1 });
}

async function findVariant(variantId, productId) {
  return ProductVariant.findOne({ _id: variantId, product: productId });
}

async function getPopulatedVariant(id) {
  return ProductVariant.findById(id)
    .populate("attachments")
    .populate("digital_file");
}

async function hasMarketplaceListings(productId) {
  return MarketplaceListing.exists({ product: productId });
}

module.exports = {
  cartesian,
  ensureUniqueProductSlug,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  getProducts,
  findProductById,
  findProductWithAttachments,
  getProductBySlug,
  getPopulatedProduct,
  createProductRecord,
  findVariantsByProductId,
  getVariantsByProduct,
  findVariant,
  getPopulatedVariant,
  hasMarketplaceListings,
};
