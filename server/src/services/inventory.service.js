// services/inventory.service.js

const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

// ── List / aggregation ────────────────────────────────────────────────────────

async function listInventory({ page = 1, limit = 20, search, location, product, variant } = {}) {
  const skip = (page - 1) * limit;

  const preFilters = [];
  if (product) {
    preFilters.push({ $match: { product: mongoose.Types.ObjectId.createFromHexString(product) } });
  }
  if (variant === "null") {
    preFilters.push({ $match: { variant: null } });
  } else if (variant) {
    preFilters.push({ $match: { variant: mongoose.Types.ObjectId.createFromHexString(variant) } });
  }

  const pipeline = [
    ...preFilters,
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: false } },
    { $match: { "product.deleted_at": null } },
    {
      $lookup: {
        from: "productvariants",
        localField: "variant",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $addFields: { variant: { $arrayElemAt: ["$variant", 0] } } },
    {
      $lookup: {
        from: "locations",
        localField: "location",
        foreignField: "_id",
        as: "location",
      },
    },
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: "attachments",
        localField: "product.attachments",
        foreignField: "_id",
        as: "product.attachments",
      },
    },
  ];

  if (search) {
    const re = new RegExp(search.trim(), "i");
    pipeline.push({
      $match: {
        $or: [
          { "product.title": re },
          { "product.sku": re },
          { "variant.sku": re },
          { "variant.display_name": re },
        ],
      },
    });
  }

  if (location) {
    pipeline.push({
      $match: {
        "location._id": mongoose.Types.ObjectId.createFromHexString(location),
      },
    });
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  pipeline.push(
    { $sort: { "product.title": 1 } },
    { $skip: skip },
    { $limit: limit },
  );

  const [items, countResult] = await Promise.all([
    Inventory.aggregate(pipeline, { withDeleted: false }),
    Inventory.aggregate(countPipeline, { withDeleted: false }),
  ]);

  const total = countResult[0]?.total || 0;

  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Fan-out: enqueue a sync_listing job for every active MarketplaceListing tied
// to this product/variant.
async function fanOutMarketplaceInventory(productId, variantId) {
  try {
    // Lazy-require to avoid circular dep at module load time
    const MarketplaceListing = require("../models/MarketplaceListing");
    const { LISTING_STATE } = require("../constants/marketplace.constants");

    const listings = await MarketplaceListing.find({
      product: productId,
      variant: variantId || null,
      state: LISTING_STATE.ACTIVE,
    }).select("_id platform").lean();

    for (const listing of listings) {
      try {
        // All live platforms currently use the eBay queue; add platform routing here
        // when additional queues (Amazon, Shopify) are introduced.
        await enqueueEbayJob("sync_listing", { listingId: listing._id.toString() });
        logger.info(`[inventory.service] fan-out queued sync_listing for ${listing._id} (${listing.platform})`);
      } catch (qErr) {
        logger.warn(`[inventory.service] fan-out queue unavailable for listing ${listing._id}`, {
          error: qErr.message,
        });
      }
    }
  } catch (err) {
    logger.warn("[inventory.service] fanOutMarketplaceInventory error", { error: err.message });
  }
}

// ── Record CRUD ───────────────────────────────────────────────────────────────

async function fetchPopulatedRecord(id) {
  return Inventory.findById(id)
    .populate("product", "title slug attachments")
    .populate("variant", "display_name sku combination")
    .populate("location", "name address");
}

async function findRecord(id) {
  return Inventory.findById(id);
}

async function ensureRecord({ product, location, variant }) {
  return Inventory.findOneAndUpdate(
    { product, location, variant: variant || null },
    {
      $setOnInsert: {
        product,
        location,
        variant: variant || null,
        stock_count: 0,
        stock_reserved: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function adjustStock(record, { adjustment, reason, type, userId }) {
  const stock_before = record.stock_count;
  const stock_after = Math.max(0, stock_before + adjustment);

  record.stock_count = stock_after;
  await record.save();

  await InventoryHistory.create({
    inventory: record._id,
    product: record.product,
    variant: record.variant,
    location: record.location,
    adjustment,
    stock_before,
    stock_after,
    reason: reason || null,
    type: type || "other",
    user: userId || null,
  });

  return { record, stock_before, stock_after };
}

async function setStock(record, { stock_count, reason, userId }) {
  const newCount = Math.round(Number(stock_count));
  const stock_before = record.stock_count;

  record.stock_count = newCount;
  await record.save();

  await InventoryHistory.create({
    inventory: record._id,
    product: record.product,
    variant: record.variant,
    location: record.location,
    adjustment: newCount - stock_before,
    stock_before,
    stock_after: newCount,
    reason: reason || null,
    type: "correction",
    user: userId || null,
  });

  return { record, stock_before, stock_after: newCount };
}

async function getHistory(inventoryId) {
  return InventoryHistory.find({ inventory: inventoryId })
    .populate("user", "first_name last_name email")
    .populate("location", "name")
    .sort({ created_at: -1 })
    .limit(100);
}

async function getTotalStockForProductVariant(productId, variantId) {
  const records = await Inventory.find({
    product: productId,
    variant: variantId || null,
  }).lean();
  return records.reduce((sum, r) => sum + (r.stock_count || 0), 0);
}

// ── SKU-based stock adjustment (used by eBay webhook) ────────────────────────

const FALLBACK_SKU_RE = /^ph-([0-9a-f]{24})(?:-([0-9a-f]{24}))?$/;

async function resolveSkuToIds(sku) {
  const match = sku.match(FALLBACK_SKU_RE);
  if (match) {
    return { productId: match[1], variantId: match[2] || null };
  }

  const variant = await ProductVariant.findOne({ sku }).lean();
  if (variant) {
    return { productId: variant.product.toString(), variantId: variant._id.toString() };
  }

  const product = await Product.findOne({ sku }).lean();
  if (product) {
    return { productId: product._id.toString(), variantId: null };
  }

  return null;
}

async function adjustStockBySku(sku, delta) {
  const ids = await resolveSkuToIds(sku);
  if (!ids) {
    logger.warn(`[inventory.service] SKU not found: ${sku}`);
    return null;
  }

  const { productId, variantId } = ids;
  const records = await Inventory.find({
    product: productId,
    variant: variantId || null,
  }).sort({ stock_count: -1 });

  if (!records.length) {
    logger.warn(`[inventory.service] No inventory records for SKU: ${sku}`);
    return null;
  }

  const adjustments = [];

  if (delta < 0) {
    let remaining = Math.abs(delta);
    for (const record of records) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, record.stock_count);
      if (deduct === 0) continue;
      await adjustStock(record, {
        adjustment: -deduct,
        reason: `eBay sale (SKU: ${sku})`,
        type: ADJUSTMENT_TYPE.EBAY_SALE,
        userId: null,
      });
      remaining -= deduct;
      adjustments.push({ recordId: record._id, adjustment: -deduct });
    }
  } else {
    await adjustStock(records[0], {
      adjustment: delta,
      reason: `eBay cancellation/return (SKU: ${sku})`,
      type: ADJUSTMENT_TYPE.EBAY_SALE,
      userId: null,
    });
    adjustments.push({ recordId: records[0]._id, adjustment: delta });
  }

  return { productId, variantId, adjustments };
}

module.exports = {
  listInventory,
  fanOutMarketplaceInventory,
  fetchPopulatedRecord,
  findRecord,
  ensureRecord,
  adjustStock,
  setStock,
  getHistory,
  getTotalStockForProductVariant,
  resolveSkuToIds,
  adjustStockBySku,
};
