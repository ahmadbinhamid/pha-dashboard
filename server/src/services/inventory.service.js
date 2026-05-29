// services/inventory.service.js

const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const ProductVariant = require("../models/ProductVariant");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { logger } = require("../loaders/logging");

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

module.exports = { listInventory, getSkuForRecord, syncInventoryToEbay };
