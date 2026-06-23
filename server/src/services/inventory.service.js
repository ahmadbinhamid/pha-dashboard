// services/inventory.service.js

const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const ProductVariant = require("../models/ProductVariant");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { logger } = require("../loaders/logging");

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

// ── eBay helpers ──────────────────────────────────────────────────────────────

async function getSkuForRecord(record) {
  if (record.variant) {
    const variant = await ProductVariant.findById(record.variant).select("sku");
    return variant?.sku || `ph-v-${record.variant}`;
  }
  return null;
}

async function syncInventoryToEbay(sku, quantity) {
  try {
    await enqueueEbayJob("update_inventory", { sku, quantity });
  } catch (qErr) {
    logger.warn("[inventory.service] eBay queue unavailable", {
      error: qErr.message,
    });
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

module.exports = {
  listInventory,
  getSkuForRecord,
  syncInventoryToEbay,
  fetchPopulatedRecord,
  findRecord,
  ensureRecord,
  adjustStock,
  setStock,
  getHistory,
  getTotalStockForProductVariant,
};
