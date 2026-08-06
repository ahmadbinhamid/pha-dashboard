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
const { withAttachmentUrls } = require("../utils/attachment");
const { getTotalStockForProduct } = require("./inventory.service");
const { STOCK_STATUS, STOCK_LOW_THRESHOLD } = require("../constants/product.constants");
const { LISTING_STATE } = require("../constants/marketplace.constants");

// ── SKU generation ────────────────────────────────────────────────────────────

async function generateNextSku(tenant) {
  // SKUs are zero-padded to 6 digits, so lexicographic desc = numeric desc
  const last = await Product.findOne(
    { tenant_id: tenant._id, sku: new RegExp(`^${tenant.code}-\\d{6}$`) },
    { sku: 1 },
  ).sort({ sku: -1 });

  const num = last?.sku ? parseInt(last.sku.slice(tenant.code.length + 1), 10) : 0;
  return `${tenant.code}-${String(num + 1).padStart(6, "0")}`;
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
        tenant_id: product.tenant_id,
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

// tenantId is required — without it this queried every tenant's active
// locations, creating an Inventory row for THIS product at every OTHER
// tenant's warehouse/showroom too. Found live during a multi-tenancy audit
// (see backfillTenantId.js's own "found live" history for Location — same
// class of bug, this call site was the one still missing the scope).
async function ensureInventoryForProduct(productId, variantId = null, tenantId) {
  if (!tenantId) throw new Error("[product.service] ensureInventoryForProduct: tenantId is required");
  const locations = await Location.find({ is_active: true, tenant_id: tenantId });
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
      $match: { $or: [{ stock_control: false }, { stock_count: { $gt: STOCK_LOW_THRESHOLD } }] },
    });
  } else if (stockFilter === STOCK_STATUS.LOW_STOCK) {
    basePipeline.push({
      $match: { stock_control: true, stock_count: { $gt: 0, $lte: STOCK_LOW_THRESHOLD } },
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
        // `url` is a Mongoose virtual, not a stored field — projecting it
        // here is a no-op; it's backfilled below via withAttachmentUrls().
        pipeline: [
          { $project: { original_name: 1, mime_type: 1, type: 1, uid: 1, file_name: 1 } },
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
      // $lookup fetches raw attachment docs, bypassing the Attachment
      // model's `url` virtual entirely — backfill it explicitly.
      attachments: withAttachmentUrls(p.attachments),
      stock_status: getStockStatus(p.stock_count, p.stock_control),
    })),
    total: countResult[0]?.total || 0,
  };
}

async function findProductById(id, tenantId) {
  return Product.findOne({ _id: id, tenant_id: tenantId });
}

// Adds a staff comment to a product's internal notes thread — never shown
// to customers. Mirrors order.service.js#addOrderNote exactly.
async function addProductNote(productId, { text, userId }, tenantId) {
  const product = await Product.findOne({ _id: productId, tenant_id: tenantId });
  if (!product) return null;

  product.internal_notes.push({ text, author: userId || null, created_at: new Date() });
  await product.save();
  return product;
}

async function getProductBySlug(slug, tenantId) {
  const product = await Product.findOne({ slug, tenant_id: tenantId })
    .populate("attachments")
    .populate("categories")
    .populate("digital_file")
    .populate("related_products", "title slug price attachments")
    .lean();
  if (!product) return null;

  // .lean() returns a plain object, so the Attachment model's `url` virtual
  // never runs here either — backfill it explicitly, same as the list endpoint.
  product.attachments = withAttachmentUrls(product.attachments);

  product.stock_count = product.stock_control
    ? await getTotalStockForProduct(product._id)
    : null;
  product.stock_status = getStockStatus(product.stock_count, product.stock_control);

  // internal_notes was added to the schema after existing products were
  // created — .lean() returns the raw stored document with no schema
  // defaults applied (unlike a hydrated Mongoose document), so any product
  // saved before this field existed comes back with the key missing entirely.
  product.internal_notes = product.internal_notes ?? [];

  // Active marketplace listings (currently only eBay) carry storefront-useful
  // content — warranty, condition notes, fitment — layered on top of the
  // product record. A product can have more than one (per platform/variant),
  // so this is always an array, even though today it's usually 0 or 1 item.
  const listings = await MarketplaceListing.find({
    product: product._id,
    state: LISTING_STATE.ACTIVE,
  })
    .populate("photo_overrides", "file_name")
    .lean();
  // Same .lean()-strips-virtuals issue as above, for each listing's photos.
  listings.forEach((listing) => {
    listing.photo_overrides = withAttachmentUrls(listing.photo_overrides);
  });

  // `display` resolves the "which value wins" precedence (listing override
  // vs. the product's own value) and merges/dedupes vehicle fitment — the
  // frontend renders this as-is rather than re-deriving it. `listings` stays
  // available too, for fields with no product-level counterpart to resolve
  // against (superseded part numbers, raw item specifics, photos).
  product.display = buildProductDisplay(product, listings);
  product.listings = listings.map(toPublicListing);

  return product;
}

async function getPopulatedProduct(id, tenantId) {
  return Product.findOne({ _id: id, tenant_id: tenantId })
    .populate("attachments")
    .populate("categories")
    .populate("digital_file");
}

// Retries on a genuine slug conflict instead of trusting a single
// check-then-insert (see utils/slug.js for why).
async function createProductRecordWithSlug(data, baseSlug, tenantId) {
  return createWithUniqueSlug(Product, baseSlug, (slug) => ({ ...data, tenant_id: tenantId, slug }), { tenantId });
}

// ── Variant CRUD ──────────────────────────────────────────────────────────────

async function getVariantsByProduct(productId, tenantId) {
  return ProductVariant.find({ product: productId, tenant_id: tenantId })
    .populate("attachments")
    .populate("digital_file")
    .sort({ display_name: 1 });
}

async function findVariant(variantId, productId, tenantId) {
  return ProductVariant.findOne({ _id: variantId, product: productId, tenant_id: tenantId });
}

async function getPopulatedVariant(id, tenantId) {
  return ProductVariant.findOne({ _id: id, tenant_id: tenantId })
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
  return saveWithUniqueSlug(product, Product, baseSlug, product._id.toString(), { tenantId: product.tenant_id });
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
  addProductNote,
  getProductBySlug,
  getPopulatedProduct,
  createProductRecordWithSlug,
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
