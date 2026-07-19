// services/product.service.js

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const Location = require("../models/Location");
const MarketplaceListing = require("../models/MarketplaceListing");
const { createWithUniqueSlug, saveWithUniqueSlug } = require("../utils/slug");
const { logger } = require("../loaders/logging");
const { getStockStatus } = require("../utils/stock");
const { toPublicListing, buildProductDisplay } = require("../utils/marketplaceListing");
const { getTotalStockForProduct } = require("./inventory.service");
const { STOCK_STATUS } = require("../constants/product.constants");
const { LISTING_STATE } = require("../constants/marketplace.constants");

// ── SKU generation ────────────────────────────────────────────────────────────

async function generateNextSku() {
  // SKUs are zero-padded to 6 digits, so lexicographic desc = numeric desc
  const last = await Product.findOne(
    { sku: /^PHA-\d{6}$/ },
    { sku: 1 },
  ).sort({ sku: -1 });

  const num = last?.sku ? parseInt(last.sku.slice(4), 10) : 0;
  return `PHA-${String(num + 1).padStart(6, "0")}`;
}

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

// Stock is joined in from the separate Inventory collection (aggregation
// can't use Mongoose .populate()), so the whole list query is an aggregation
// pipeline rather than Product.find() — this also lets `stockFilter` match
// against the just-computed stock_count in the same query.
async function getProducts(filter, { skip, limit, sort = { created_at: -1 }, stockFilter } = {}) {
  const basePipeline = [
    { $match: filter },
    {
      $lookup: {
        from: "inventories",
        localField: "_id",
        foreignField: "product",
        as: "_inventory",
      },
    },
    {
      $addFields: {
        stock_count: {
          $cond: ["$stock_control", { $sum: "$_inventory.stock_count" }, null],
        },
      },
    },
    { $project: { _inventory: 0 } },
  ];

  if (stockFilter === STOCK_STATUS.IN_STOCK) {
    basePipeline.push({
      $match: { $or: [{ stock_control: false }, { stock_count: { $gt: 0 } }] },
    });
  } else if (stockFilter === STOCK_STATUS.OUT_OF_STOCK) {
    basePipeline.push({
      $match: { stock_control: true, stock_count: { $lte: 0 } },
    });
  }

  const countPipeline = [...basePipeline, { $count: "total" }];
  const pipeline = [
    ...basePipeline,
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "attachments",
        localField: "attachments",
        foreignField: "_id",
        as: "attachments",
        pipeline: [
          { $project: { url: 1, original_name: 1, mime_type: 1, type: 1, uid: 1, file_name: 1 } },
        ],
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "categories",
        foreignField: "_id",
        as: "categories",
        pipeline: [{ $project: { name: 1, slug: 1 } }],
      },
    },
  ];

  const [items, countResult] = await Promise.all([
    Product.aggregate(pipeline),
    Product.aggregate(countPipeline),
  ]);

  return {
    items: items.map((p) => ({
      ...p,
      stock_status: getStockStatus(p.stock_count, p.stock_control),
    })),
    total: countResult[0]?.total || 0,
  };
}

async function findProductById(id) {
  return Product.findById(id);
}

async function getProductBySlug(slug) {
  const product = await Product.findOne({ slug })
    .populate("attachments")
    .populate("categories")
    .populate("digital_file")
    .populate("related_products", "title slug price attachments")
    .lean();
  if (!product) return null;

  product.stock_count = product.stock_control
    ? await getTotalStockForProduct(product._id)
    : null;
  product.stock_status = getStockStatus(product.stock_count, product.stock_control);

  // Active marketplace listings (currently only eBay) carry storefront-useful
  // content — warranty, condition notes, fitment — layered on top of the
  // product record. A product can have more than one (per platform/variant),
  // so this is always an array, even though today it's usually 0 or 1 item.
  const listings = await MarketplaceListing.find({
    product: product._id,
    state: LISTING_STATE.ACTIVE,
  })
    .populate("photo_overrides", "url")
    .lean();

  // `display` resolves the "which value wins" precedence (listing override
  // vs. the product's own value) and merges/dedupes vehicle fitment — the
  // frontend renders this as-is rather than re-deriving it. `listings` stays
  // available too, for fields with no product-level counterpart to resolve
  // against (superseded part numbers, raw item specifics, photos).
  product.display = buildProductDisplay(product, listings);
  product.listings = listings.map(toPublicListing);

  return product;
}

async function getPopulatedProduct(id) {
  return Product.findById(id)
    .populate("attachments")
    .populate("categories")
    .populate("digital_file");
}

// Retries on a genuine slug conflict instead of trusting a single
// check-then-insert (see utils/slug.js for why).
async function createProductRecordWithSlug(data, baseSlug) {
  return createWithUniqueSlug(Product, baseSlug, (slug) => ({ ...data, slug }));
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

async function saveProduct(product) {
  return product.save();
}

// For renames: retries on a genuine slug conflict instead of trusting a
// single check-then-save (see utils/slug.js for why).
async function saveProductWithUniqueSlug(product, baseSlug) {
  return saveWithUniqueSlug(product, Product, baseSlug, product._id.toString());
}

async function softDeleteProduct(product) {
  return product.softDelete();
}

async function saveVariant(variant) {
  return variant.save();
}

async function applyStockEntries(productId, stockEntries) {
  for (const entry of stockEntries) {
    if (entry.qty > 0) {
      await Inventory.updateOne(
        { product: productId, variant: null, location: entry.location_id },
        { $set: { stock_count: entry.qty } },
      );
    }
  }
}

module.exports = {
  cartesian,
  generateNextSku,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  getProducts,
  findProductById,
  getProductBySlug,
  getPopulatedProduct,
  createProductRecordWithSlug,
  findVariantsByProductId,
  getVariantsByProduct,
  findVariant,
  getPopulatedVariant,
  hasMarketplaceListings,
  saveProduct,
  saveProductWithUniqueSlug,
  softDeleteProduct,
  saveVariant,
  applyStockEntries,
};
