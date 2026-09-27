// services/inventory.service.js

const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
// Not destructured, so test mocks apply whenever they're installed.
const channelQueue = require("../queues/channel.queue");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { buildWordSearchOr } = require("../utils/regex");

// ── List / aggregation ──

// Inventory has no tenant_id; scope via the joined product.tenant_id.
async function listInventory(tenantId, { page = 1, limit = 20, search, location, product, variant } = {}) {
  if (!tenantId) throw new Error("[inventory.service] listInventory: tenantId is required");
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
    { $match: { "product.deleted_at": null, "product.tenant_id": tenantId } },
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
    pipeline.push({
      $match: {
        $or: buildWordSearchOr(
          ["product.title", "product.sku", "variant.sku", "variant.display_name"],
          search,
        ),
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

// The one stock-to-marketplace path: claims a fencing seq, then enqueues.
async function fanOutMarketplaceInventory(productId, variantId, tenantId) {
  if (!tenantId) {
    throw new Error("[inventory.service] fanOutMarketplaceInventory: tenantId is required");
  }

  const results = [];
  try {
    // Lazy-require to avoid circular dep at module load time
    const MarketplaceListing = require("../models/MarketplaceListing");
    const { LISTING_STATE } = require("../constants/marketplace.constants");
    const registry = require("./marketplace/registry");

    const listings = await MarketplaceListing.find({
      product: productId,
      variant: variantId || null,
      tenant_id: tenantId,
      state: LISTING_STATE.ACTIVE,
    }).select("_id platform").lean();

    for (const listing of listings) {
      // A listing can outlive its adapter; skip it, don't abort the fan-out.
      if (!registry.has(listing.platform)) {
        logger.warn(`[inventory.service] fan-out skipped: no adapter registered for platform "${listing.platform}" (listing ${listing._id})`);
        results.push({ listingId: listing._id.toString(), platform: listing.platform, queued: false, error: "no_adapter" });
        continue;
      }

      try {
        // push_seq is on the base schema, so every platform gets a fencing token.
        const updated = await MarketplaceListing.findOneAndUpdate(
          { _id: listing._id, tenant_id: tenantId },
          { $inc: { push_seq: 1 } },
          { new: true },
        ).select("push_seq");
        const seq = updated ? (updated.push_seq ?? null) : null;

        await channelQueue.enqueueChannelJob(listing.platform, "sync_listing", { listingId: listing._id.toString(), seq });
        logger.info(`[inventory.service] fan-out queued sync_listing for ${listing._id} (${listing.platform}, seq ${seq})`);
        results.push({ listingId: listing._id.toString(), platform: listing.platform, queued: true, seq });
      } catch (qErr) {
        logger.warn(`[inventory.service] fan-out queue unavailable for listing ${listing._id}`, {
          error: qErr.message,
        });
        results.push({ listingId: listing._id.toString(), platform: listing.platform, queued: false, error: qErr.message });
      }
    }
  } catch (err) {
    logger.warn("[inventory.service] fanOutMarketplaceInventory error", { error: err.message });
  }
  return results;
}

// ── Record CRUD ──

async function fetchPopulatedRecord(id) {
  return Inventory.findById(id)
    .populate("product", "title slug attachments")
    .populate("variant", "display_name sku combination")
    .populate("location", "name address");
}

// Inventory has no tenant_id; ownership is checked via its product.
async function findRecord(id, tenantId) {
  const record = await Inventory.findById(id);
  if (!record) return null;
  const owned = await Product.exists({ _id: record.product, tenant_id: tenantId });
  if (!owned) return null;
  return record;
}

// Product and location must both belong to the tenant before linking.
async function ensureRecord({ product, location, variant }, tenantId) {
  const Location = require("../models/Location");
  const [ownsProduct, ownsLocation] = await Promise.all([
    Product.exists({ _id: product, tenant_id: tenantId }),
    Location.exists({ _id: location, tenant_id: tenantId }),
  ]);
  if (!ownsProduct || !ownsLocation) return null;

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

// CAS retry: concurrent adjustments must not clobber each other's delta.
async function adjustStock(record, { adjustment, reason, type, userId, tenantId, skipMarketplaceFanOut = false }) {
  let current = record;
  let stock_before, stock_after, updated;

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    stock_before = current.stock_count;
    stock_after = Math.max(0, stock_before + adjustment);

    updated = await Inventory.findOneAndUpdate(
      { _id: current._id, stock_count: stock_before },
      { $set: { stock_count: stock_after } },
      { new: true },
    );
    if (updated) break;

    current = await Inventory.findById(record._id);
    if (!current) {
      throw new Error(`[inventory.service] adjustStock: record ${record._id} no longer exists`);
    }
  }

  if (!updated) {
    throw new Error(
      `[inventory.service] adjustStock: record ${record._id} still conflicting after ${MAX_ATTEMPTS} attempts — high contention`,
    );
  }

  // Keep the caller's in-memory doc in step with what was persisted.
  record.stock_count = stock_after;

  // History keeps the true requested delta; clamped_shortfall is the gap.
  const clamped_shortfall = stock_before + adjustment < 0 ? Math.abs(stock_before + adjustment) : 0;

  await InventoryHistory.create({
    inventory: record._id,
    product: record.product,
    variant: record.variant,
    location: record.location,
    adjustment,
    stock_before,
    stock_after,
    clamped_shortfall,
    reason: reason || null,
    type: type || "other",
    user: userId || null,
  });

  // Fan out every change, except a delta that came from eBay itself.
  const marketplaceResults = skipMarketplaceFanOut
    ? []
    : await fanOutMarketplaceInventory(record.product, record.variant, tenantId);

  return { record, stock_before, stock_after, marketplaceResults };
}

// Absolute set: read the old value atomically so history stays right.
async function setStock(record, { stock_count, reason, userId, tenantId }) {
  const newCount = Math.round(Number(stock_count));

  const previous = await Inventory.findOneAndUpdate(
    { _id: record._id },
    { $set: { stock_count: newCount } },
    { new: false },
  );
  if (!previous) {
    throw new Error(`[inventory.service] setStock: record ${record._id} no longer exists`);
  }
  const stock_before = previous.stock_count;
  record.stock_count = newCount;

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

  await fanOutMarketplaceInventory(record.product, record.variant, tenantId);

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

// Batched: Map(stockKey -> total); missing pairs are 0.
function stockKey(productId, variantId) {
  return `${productId}:${variantId || ""}`;
}

async function getTotalStockForProductVariants(pairs) {
  const totals = new Map(pairs.map(({ productId, variantId }) => [stockKey(productId, variantId), 0]));
  if (!pairs.length) return totals;
  const rows = await Inventory.aggregate([
    { $match: { $or: pairs.map(({ productId, variantId }) => ({ product: new mongoose.Types.ObjectId(String(productId)), variant: variantId ? new mongoose.Types.ObjectId(String(variantId)) : null })) } },
    { $group: { _id: { product: "$product", variant: "$variant" }, total: { $sum: { $ifNull: ["$stock_count", 0] } } } },
  ]);
  for (const row of rows) totals.set(stockKey(row._id.product, row._id.variant), row.total);
  return totals;
}

/** Total stock per product (all variants and locations) in one query. */
async function getTotalStockForProducts(productIds) {
  const totals = new Map(productIds.map((id) => [String(id), 0]));
  if (!productIds.length) return totals;
  const rows = await Inventory.aggregate([
    { $match: { product: { $in: productIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
    { $group: { _id: "$product", total: { $sum: { $ifNull: ["$stock_count", 0] } } } },
  ]);
  for (const row of rows) totals.set(String(row._id), row.total);
  return totals;
}

// Product-level rollup across all variants/locations (detail badge).
async function getTotalStockForProduct(productId) {
  const records = await Inventory.find({ product: productId }).lean();
  return records.reduce((sum, r) => sum + (r.stock_count || 0), 0);
}

// Stock summed across locations per product/variant, for live products only.
function stockPerItemStages(tenantId) {
  return [
    {
      // Tenant filter and projection inside the join, so no full product docs.
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        pipeline: [
          { $match: { tenant_id: tenantId, deleted_at: null } },
          { $project: { title: 1, sku: 1 } },
        ],
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $group: {
        _id: { product: "$product._id", variant: "$variant" },
        totalStock: { $sum: "$stock_count" },
        productTitle: { $first: "$product.title" },
        productSku: { $first: "$product.sku" },
      },
    },
  ];
}

/** Tracked items, units on hand, and low / out-of-stock counts in one pass. */
async function getInventoryStats(tenantId, lowStockThreshold) {
  const [totals] = await Inventory.aggregate([
    ...stockPerItemStages(tenantId),
    {
      $group: {
        _id: null,
        trackedItems: { $sum: 1 },
        unitsInStock: { $sum: { $max: ["$totalStock", 0] } },
        lowStock: {
          $sum: { $cond: [{ $and: [{ $gt: ["$totalStock", 0] }, { $lte: ["$totalStock", lowStockThreshold] }] }, 1, 0] },
        },
        outOfStock: { $sum: { $cond: [{ $lte: ["$totalStock", 0] }, 1, 0] } },
      },
    },
  ]);
  return {
    trackedItems: totals?.trackedItems ?? 0,
    unitsInStock: totals?.unitsInStock ?? 0,
    lowStockCount: totals?.lowStock ?? 0,
    outOfStockCount: totals?.outOfStock ?? 0,
    lowStockThreshold,
  };
}

// Total stock > 0 and <= threshold; same shape as the dashboard tile.
async function getLowStockItems(tenantId, lowStockThreshold) {
  const rows = await Inventory.aggregate([
    ...stockPerItemStages(tenantId),
    { $match: { totalStock: { $gt: 0, $lte: lowStockThreshold } } },
    {
      $lookup: {
        from: "productvariants",
        localField: "_id.variant",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: { path: "$variant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        product_id: "$_id.product",
        variant_id: "$_id.variant",
        title: "$productTitle",
        // Variant SKU when it has one, else the parent product's SKU.
        sku: { $ifNull: ["$variant.sku", "$productSku"] },
        variant_name: "$variant.display_name",
        stock: "$totalStock",
      },
    },
    { $sort: { stock: 1 } },
  ]);
  return rows;
}

// ── SKU-based stock adjustment (eBay webhook, Stripe) ──

const FALLBACK_SKU_RE = /^ph-([0-9a-f]{24})(?:-([0-9a-f]{24}))?$/;

// SKUs are unique per tenant only; ph-<id> callers check tenant themselves.
async function resolveSkuToIds(sku, tenantId) {
  if (!tenantId) throw new Error("[inventory.service] resolveSkuToIds: tenantId is required");

  const match = sku.match(FALLBACK_SKU_RE);
  if (match) {
    return { productId: match[1], variantId: match[2] || null };
  }

  const variant = await ProductVariant.findOne({ sku, tenant_id: tenantId }).lean();
  if (variant) {
    return { productId: variant.product.toString(), variantId: variant._id.toString() };
  }

  const product = await Product.findOne({ sku, tenant_id: tenantId }).lean();
  if (product) {
    return { productId: product._id.toString(), variantId: null };
  }

  return null;
}

// Adjusts a SKU across locations; returns per-record deltas and shortfall.
async function adjustStockForSku(sku, delta, { reason, type, userId = null, tenantId, skipMarketplaceFanOut = false } = {}) {
  const ids = await resolveSkuToIds(sku, tenantId);
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
  let shortfall = 0;

  // One fan-out result per call: every adjustStock here hits one listing set.
  let marketplaceResults = [];

  if (delta < 0) {
    let remaining = Math.abs(delta);
    let lastRecord = null;
    for (const record of records) {
      lastRecord = record;
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, record.stock_count);
      if (deduct === 0) continue;
      const { stock_before, stock_after, marketplaceResults: mr } = await adjustStock(record, {
        adjustment: -deduct,
        reason,
        type,
        userId,
        tenantId,
        skipMarketplaceFanOut,
      });
      remaining -= deduct;
      adjustments.push({ recordId: record._id, adjustment: -deduct, stock_before, stock_after });
      if (mr.length) marketplaceResults = mr;
    }
    shortfall = remaining;
    if (shortfall > 0) {
      logger.warn(`[inventory.service] oversold SKU ${sku} by ${shortfall}`);
      // All out of stock: log the oversell on the last record, with no fan-out.
      const { stock_before, stock_after } = await adjustStock(lastRecord, {
        adjustment: -remaining,
        reason,
        type,
        userId,
        tenantId,
        skipMarketplaceFanOut: true,
      });
      adjustments.push({ recordId: lastRecord._id, adjustment: -remaining, stock_before, stock_after });
    }
  } else {
    const { stock_before, stock_after, marketplaceResults: mr } = await adjustStock(records[0], {
      adjustment: delta,
      reason,
      type,
      userId,
      tenantId,
      skipMarketplaceFanOut,
    });
    adjustments.push({ recordId: records[0]._id, adjustment: delta, stock_before, stock_after });
    marketplaceResults = mr;
  }

  const totalStockAfter = await getTotalStockForProductVariant(productId, variantId);

  return { productId, variantId, adjustments, shortfall, totalStockAfter, marketplaceResults };
}

// Thin wrapper preserving the original eBay behavior and return shape.
async function adjustStockBySku(sku, delta, tenantId) {
  const result = await adjustStockForSku(sku, delta, {
    reason:
      delta < 0
        ? `eBay sale (SKU: ${sku})`
        : `eBay cancellation/return (SKU: ${sku})`,
    type: ADJUSTMENT_TYPE.EBAY_SALE,
    userId: null,
    tenantId,
  });
  if (!result) return null;

  // NOTE: best-guess eBay baseline; drift is caught by two-poll confirmation.
  try {
    const MarketplaceListing = require("../models/MarketplaceListing");
    const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");
    await MarketplaceListing.updateOne(
      {
        tenant_id: tenantId,
        product: result.productId,
        variant: result.variantId || null,
        platform: MARKETPLACE_PLATFORM.EBAY,
      },
      {
        $set: {
          // TODO(dual-write): drop ebay_synced_* after backfill; use synced_*.
          ebay_synced_quantity: result.totalStockAfter,
          ebay_synced_at: new Date(),
          synced_quantity: result.totalStockAfter,
          synced_at: new Date(),
        },
      },
      // strict: false, or updateOne drops these discriminator-only paths.
      { strict: false },
    );
  } catch (err) {
    logger.warn(`[inventory.service] failed to update ebay_synced_quantity baseline for SKU ${sku}: ${err.message}`);
  }

  return {
    productId: result.productId,
    variantId: result.variantId,
    adjustments: result.adjustments.map(({ recordId, adjustment }) => ({ recordId, adjustment })),
  };
}

module.exports = {
  listInventory,
  fanOutMarketplaceInventory,
  getTotalStockForProducts,
  fetchPopulatedRecord,
  findRecord,
  ensureRecord,
  adjustStock,
  setStock,
  getHistory,
  getTotalStockForProductVariant,
  getTotalStockForProductVariants,
  stockKey,
  getTotalStockForProduct,
  getLowStockItems,
  getInventoryStats,
  resolveSkuToIds,
  adjustStockForSku,
  adjustStockBySku,
};
