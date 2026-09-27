// services/product.service.js

const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const Location = require("../models/Location");
const MarketplaceListing = require("../models/MarketplaceListing");
const { createWithUniqueSlug, saveWithUniqueSlug } = require("../utils/slug");
const { logger } = require("../loaders/logging");
const { getStockStatus } = require("../utils/stock");
const { toPublicListing, buildProductDisplay } = require("../utils/marketplaceListing");
const { withAttachmentUrls, buildAttachmentFilePath } = require("../utils/attachment");
const inventoryService = require("./inventory.service");
const locationService = require("./location.service");
const { getTotalStockForProduct } = inventoryService;
const { getCompanyProfile } = require("./tenantSettings.service");
const emailService = require("./email/email.service");
const { STOCK_STATUS, STOCK_LOW_THRESHOLD } = require("../constants/product.constants");
const { LISTING_STATE } = require("../constants/marketplace.constants");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

// ── SKU generation ──

async function generateNextSku(tenant) {
  // withDeleted: the unique sku index covers soft-deleted rows too.
  const last = await Product.findOne(
    { tenant_id: tenant._id, sku: new RegExp(`^${tenant.code}-\\d{6}$`) },
    { sku: 1 },
  )
    .setOptions({ withDeleted: true })
    .sort({ sku: -1 });

  const num = last?.sku ? parseInt(last.sku.slice(tenant.code.length + 1), 10) : 0;
  return `${tenant.code}-${String(num + 1).padStart(6, "0")}`;
}

// ── Variant generation ──

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

// tenantId scope stops stock rows at other tenants' locations.
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

// ── Product CRUD ──

// Aggregation so stock (Inventory) can be joined and filtered in one query.
function buildStockStages(stockFilter) {
  const stages = [
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
    stages.push({
      $match: { $or: [{ stock_control: false }, { stock_count: { $gt: STOCK_LOW_THRESHOLD } }] },
    });
  } else if (stockFilter === STOCK_STATUS.LOW_STOCK) {
    stages.push({
      $match: { stock_control: true, stock_count: { $gt: 0, $lte: STOCK_LOW_THRESHOLD } },
    });
  } else if (stockFilter === STOCK_STATUS.OUT_OF_STOCK) {
    stages.push({
      $match: { stock_control: true, stock_count: { $lte: 0 } },
    });
  }

  return stages;
}

// $lookup skips soft-delete middleware, so deleted_at is matched here.
function buildChannelStages(channel) {
  if (!channel) return [];

  const stages = [
    {
      $lookup: {
        from: "marketplacelistings",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$product", "$$productId"] },
              state: LISTING_STATE.ACTIVE,
              deleted_at: null,
            },
          },
          { $project: { platform: 1 } },
        ],
        as: "_channelListings",
      },
    },
  ];

  stages.push(
    channel === "none"
      ? { $match: { _channelListings: { $size: 0 } } }
      : { $match: { "_channelListings.platform": channel } },
  );
  stages.push({ $project: { _channelListings: 0 } });

  return stages;
}

// Shared attachment/category hydration for both listing paths.
const HYDRATION_STAGES = [
  {
    $lookup: {
      from: "attachments",
      localField: "attachments",
      foreignField: "_id",
      as: "attachments",
      // `url` is a virtual; projecting it is a no-op, see withAttachmentUrls.
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

function withComputedFields(p) {
  return {
    ...p,
    // $lookup bypasses the `url` virtual; backfilled explicitly.
    attachments: withAttachmentUrls(p.attachments),
    stock_status: getStockStatus(p.stock_count, p.stock_control),
  };
}

async function getProducts(filter, { skip, limit, sort = { created_at: -1 }, stockFilter, channelFilter } = {}) {
  const basePipeline = [
    { $match: filter },
    ...buildStockStages(stockFilter),
    ...buildChannelStages(channelFilter),
  ];

  const countPipeline = [...basePipeline, { $count: "total" }];
  const pipeline = [
    ...basePipeline,
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    ...HYDRATION_STAGES,
  ];

  const [items, countResult] = await Promise.all([
    Product.aggregate(pipeline),
    Product.aggregate(countPipeline),
  ]);

  return {
    items: items.map(withComputedFields),
    total: countResult[0]?.total || 0,
  };
}

// Header tiles; reuses buildStockStages so counts match the filter.
async function getProductStats(tenantId) {
  const [result] = await Product.aggregate([
    { $match: { tenant_id: tenantId } },
    ...buildStockStages(),
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalSkus: { $sum: 1 },
              totalStockUnits: { $sum: { $cond: ["$stock_control", "$stock_count", 0] } },
              avgPrice: { $avg: "$price" },
              avgMarginPct: {
                $avg: {
                  $cond: [
                    { $and: [{ $gt: ["$price", 0] }, { $ne: ["$cost_price", null] }] },
                    { $multiply: [{ $divide: [{ $subtract: ["$price", "$cost_price"] }, "$price"] }, 100] },
                    null,
                  ],
                },
              },
            },
          },
        ],
        outOfStock: [
          { $match: { stock_control: true, stock_count: { $lte: 0 } } },
          { $count: "count" },
        ],
      },
    },
  ]);

  return {
    totalSkus: result.totals[0]?.totalSkus ?? 0,
    totalStockUnits: result.totals[0]?.totalStockUnits ?? 0,
    outOfStockCount: result.outOfStock[0]?.count ?? 0,
    avgPrice: result.totals[0]?.avgPrice ?? 0,
    avgMarginPct: result.totals[0]?.avgMarginPct ?? null,
  };
}

// Re-sorts to Typesense relevance order; $in doesn't preserve order.
async function getProductsByIds(ids, { stockFilter, channelFilter } = {}) {
  if (!ids.length) return { items: [] };

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const pipeline = [
    { $match: { _id: { $in: objectIds } } },
    ...buildStockStages(stockFilter),
    ...buildChannelStages(channelFilter),
    ...HYDRATION_STAGES,
  ];

  const items = await Product.aggregate(pipeline);
  const byId = new Map(items.map((p) => [p._id.toString(), p]));

  return {
    items: ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(withComputedFields),
  };
}

async function findProductById(id, tenantId) {
  return Product.findOne({ _id: id, tenant_id: tenantId });
}

// Index workers have no tenantId; null = deleted since enqueued.
async function findProductByIdForIndexing(id) {
  return Product.findById(id);
}

// Staff-only note; mirrors order.service.js#addOrderNote.
async function addProductNote(productId, { text, userId }, tenantId) {
  const product = await Product.findOne({ _id: productId, tenant_id: tenantId });
  if (!product) return null;

  product.internal_notes.push({ text, author: userId || null, created_at: new Date() });
  await product.save();
  return product;
}

// Attachments go to nodemailer by disk path, not base64.
async function sendProductInfoEmail(productId, { name, email }, tenantId) {
  const product = await getPopulatedProduct(productId, tenantId);
  if (!product) return null;

  const companyProfile = await getCompanyProfile(tenantId);
  const attachments = (product.attachments || [])
    .filter((att) => att.file_name)
    .map((att) => ({
      filename: att.original_name || att.file_name,
      path: buildAttachmentFilePath(att.file_name),
      contentType: att.mime_type || undefined,
    }));

  await emailService.sendProductInfo({
    to: email,
    name,
    productTitle: product.title,
    productSku: product.sku,
    attachments,
    companyProfile,
    tenantId,
  });

  return product;
}

// Scanned tags carry the id (autopartspro://product/<id>).
function slugOrIdFilter(key) {
  return mongoose.isValidObjectId(key) && /^[a-f0-9]{24}$/i.test(key)
    ? { $or: [{ slug: key }, { _id: key }] }
    : { slug: key };
}

async function getProductBySlugOrId(key, tenantId) {
  const product = await Product.findOne({ ...slugOrIdFilter(key), tenant_id: tenantId })
    .populate("attachments")
    .populate("categories")
    .populate("digital_file")
    .populate("related_products", "title slug price attachments")
    .lean();
  if (!product) return null;

  // .lean() skips the `url` virtual; backfill as the list does.
  product.attachments = withAttachmentUrls(product.attachments);

  product.stock_count = product.stock_control
    ? await getTotalStockForProduct(product._id)
    : null;
  product.stock_status = getStockStatus(product.stock_count, product.stock_control);

  // .lean() skips defaults; products older than this field lack it.
  product.internal_notes = product.internal_notes ?? [];

  // Active listings add warranty/fitment content; always an array.
  const listings = await MarketplaceListing.find({
    product: product._id,
    state: LISTING_STATE.ACTIVE,
  })
    .populate("photo_overrides", "file_name")
    .lean();
  // Same .lean() virtual issue, for each listing's photos.
  listings.forEach((listing) => {
    listing.photo_overrides = withAttachmentUrls(listing.photo_overrides);
  });

  // `display` resolves listing vs product precedence for the frontend.
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

// Retries on a real slug conflict (see utils/slug.js).
async function createProductRecordWithSlug(data, baseSlug, tenantId) {
  return createWithUniqueSlug(Product, baseSlug, (slug) => ({ ...data, tenant_id: tenantId, slug }), { tenantId });
}

// ── Variant CRUD ──

async function getVariantsByProduct(productId, tenantId) {
  return ProductVariant.find({ product: productId, tenant_id: tenantId })
    .populate("attachments")
    .populate("digital_file")
    .sort({ display_name: 1 });
}

async function findVariant(variantId, productId, tenantId) {
  return ProductVariant.findOne({ _id: variantId, product: productId, tenant_id: tenantId });
}

// Id-only variant lookup for marketplace fan-out; no populate needed.
async function listVariantIdsForProduct(productId, tenantId) {
  const variants = await ProductVariant.find({ product: productId, tenant_id: tenantId })
    .select("_id")
    .lean();
  return variants.map((v) => v._id);
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

// Rename retries on a real slug conflict (see utils/slug.js).
async function saveProductWithUniqueSlug(product, baseSlug) {
  return saveWithUniqueSlug(product, Product, baseSlug, product._id.toString(), { tenantId: product.tenant_id });
}

async function softDeleteProduct(product) {
  return product.softDelete();
}

async function saveVariant(variant) {
  return variant.save();
}

// Via adjustStock so opening stock shows in the stock history.
async function applyStockEntries(productId, stockEntries, { tenantId, userId } = {}) {
  // Looked up once, only if an entry arrives without a location.
  let mainWarehouseId;
  const locationFor = async (entry) => {
    if (entry.location_id) return entry.location_id;
    if (mainWarehouseId === undefined) {
      mainWarehouseId = (await locationService.findMainWarehouse(tenantId))?._id ?? null;
    }
    return mainWarehouseId;
  };

  for (const entry of stockEntries) {
    if (!(entry.qty > 0)) continue;
    const location = await locationFor(entry);
    if (!location) continue;

    const record = await Inventory.findOne({ product: productId, variant: null, location });
    if (!record) continue;

    await inventoryService.adjustStock(record, {
      adjustment: entry.qty,
      reason: "Opening stock on product creation",
      type: ADJUSTMENT_TYPE.RESTOCK,
      userId,
      tenantId,
    });
  }
}

// Autocomplete hydration: only the fields a suggestion row renders.
async function getProductSuggestions(ids) {
  if (!ids.length) return [];

  const products = await Product.find({ _id: { $in: ids } })
    .select("title slug sku mpn price attachments")
    .populate("attachments", "original_name mime_type type uid file_name")
    .lean();

  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => ({ ...p, attachments: withAttachmentUrls(p.attachments) }));
}

module.exports = {
  cartesian,
  generateNextSku,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  getProducts,
  getProductStats,
  getProductsByIds,
  getProductSuggestions,
  findProductById,
  findProductByIdForIndexing,
  addProductNote,
  sendProductInfoEmail,
  getProductBySlugOrId,
  getPopulatedProduct,
  createProductRecordWithSlug,
  getVariantsByProduct,
  listVariantIdsForProduct,
  findVariant,
  getPopulatedVariant,
  hasMarketplaceListings,
  saveProduct,
  saveProductWithUniqueSlug,
  softDeleteProduct,
  saveVariant,
  applyStockEntries,
};
