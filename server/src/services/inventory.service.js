// services/inventory.service.js

const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { escapeRegex } = require("../utils/regex");

// ── List / aggregation ────────────────────────────────────────────────────────

// tenantId is required — Inventory has no tenant_id field of its own (see
// Inventory.js), so scoping goes through this $match on product.tenant_id
// right after the product $lookup. Previously entirely unscoped: any
// authenticated admin, from any tenant, saw every OTHER tenant's inventory
// on this list. Found live, the moment a second real tenant existed.
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
    const re = new RegExp(escapeRegex(search.trim()), "i");
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

// tenantId required — Inventory has no tenant_id of its own, so ownership
// is verified via the record's product. Previously a bare findById with no
// check at all: any authenticated admin, from any tenant, could adjust/set
// stock or read history on ANY OTHER tenant's inventory record just by
// knowing (or enumerating) a valid ObjectId — a write vulnerability, not
// just a read leak. Found live.
async function findRecord(id, tenantId) {
  const record = await Inventory.findById(id);
  if (!record) return null;
  const owned = await Product.exists({ _id: record.product, tenant_id: tenantId });
  if (!owned) return null;
  return record;
}

// tenantId required — verifies both `product` AND `location` actually
// belong to this tenant before creating/upserting an Inventory record
// linking them. Previously unchecked: any tenant could pass another
// tenant's product or location id here and create a phantom stock record
// linked to it. Found live.
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

// Compare-and-swap retry instead of a plain read-then-.save(): two
// concurrent adjustments on the same record (e.g. a real-time eBay webhook
// deduction racing the inventory-reconciliation poll, or a Stripe sale
// racing an eBay order-poll deduction) previously both read the same
// stock_count, computed independently, and the second .save() silently
// clobbered the first — no error, no warning, lost stock movement. This
// re-reads and retries on conflict instead of trusting an in-memory value
// that may already be stale by the time it writes.
async function adjustStock(record, { adjustment, reason, type, userId }) {
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

  // Keep the caller's in-memory document consistent with what was actually
  // persisted (callers like adjustStockForSku read record.stock_count
  // afterward via the returned stock_after, but some also hold onto `record`).
  record.stock_count = stock_after;

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

  // Every stock change — manual correction or a sale/refund driving this via
  // adjustStockForSku below — should keep the listing's sync_status (and, if
  // it just hit/left zero, quantity on eBay) current. Centralized here
  // instead of at each call site so no adjustment path can forget it.
  await fanOutMarketplaceInventory(record.product, record.variant);

  return { record, stock_before, stock_after };
}

// This is an absolute set (not a delta), so unlike adjustStock() there's
// nothing to retry on conflict — but the pre-write value still needs to be
// read atomically with the write itself, or a concurrent adjustment landing
// between a plain read and this save would silently vanish AND get logged
// with a wrong stock_before in the audit trail.
async function setStock(record, { stock_count, reason, userId }) {
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

  await fanOutMarketplaceInventory(record.product, record.variant);

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

// Product-level rollup across all variants/locations — used for the
// product detail page's stock badge, unlike the variant-scoped helper above.
async function getTotalStockForProduct(productId) {
  const records = await Inventory.find({ product: productId }).lean();
  return records.reduce((sum, r) => sum + (r.stock_count || 0), 0);
}

// ── SKU-based stock adjustment (used by eBay webhook and Stripe payment/refund) ─

const FALLBACK_SKU_RE = /^ph-([0-9a-f]{24})(?:-([0-9a-f]{24}))?$/;

// tenantId is required — SKUs are only unique PER TENANT (see Product.js's
// {tenant_id, sku} unique index), never globally. An unscoped lookup here
// previously meant two tenants sharing the same generic SKU string (common
// for auto-part codes) could corrupt each other's stock: found live, see
// git history for this comment. The fallback `ph-<productId>` form is exempt
// since it already carries an unambiguous product id, but the id it embeds
// still isn't verified as belonging to tenantId here — callers that need
// that guarantee (e.g. order import) do their own tenant check on the
// resolved ids, same as ever.
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

// Generic core: deducts/credits stock for a SKU across its location records
// (largest-stock-first for deductions, same as before), under a caller-supplied
// reason/type/userId. Unlike the old eBay-only version, this:
//   - returns stock_before/stock_after per adjustment (previously computed by
//     adjustStock() but silently discarded)
//   - returns `shortfall` — how much of a deduction could NOT be covered by
//     available stock, instead of silently clamping to 0 and hiding an oversell
//   - returns `totalStockAfter` — the SKU's new total across all locations,
//     which callers pushing quantity to a marketplace need as the absolute
//     value to send (eBay's inventory API takes an absolute quantity, not a delta)
async function adjustStockForSku(sku, delta, { reason, type, userId = null, tenantId } = {}) {
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

  if (delta < 0) {
    let remaining = Math.abs(delta);
    for (const record of records) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, record.stock_count);
      if (deduct === 0) continue;
      const { stock_before, stock_after } = await adjustStock(record, {
        adjustment: -deduct,
        reason,
        type,
        userId,
      });
      remaining -= deduct;
      adjustments.push({ recordId: record._id, adjustment: -deduct, stock_before, stock_after });
    }
    shortfall = remaining;
    if (shortfall > 0) {
      logger.warn(`[inventory.service] oversold SKU ${sku} by ${shortfall}`);
    }
  } else {
    const { stock_before, stock_after } = await adjustStock(records[0], {
      adjustment: delta,
      reason,
      type,
      userId,
    });
    adjustments.push({ recordId: records[0]._id, adjustment: delta, stock_before, stock_after });
  }

  const totalStockAfter = await getTotalStockForProductVariant(productId, variantId);

  return { productId, variantId, adjustments, shortfall, totalStockAfter };
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

  // Stamp MarketplaceListing.ebay_synced_quantity synchronously with the
  // post-adjustment total, right here, instead of relying solely on the
  // async sync_listing queue job (fanned out by adjustStock() above) to get
  // around to it. That job can be delayed or exhaust its retries — and
  // until it lands, this baseline stays at its pre-sale value. Since eBay
  // has already decremented its own live quantity for this same sale, the
  // next inventory-reconciliation poll (ebay.inventory-sync.service.js)
  // would otherwise see live-quantity-vs-stale-baseline as a fresh
  // "changed directly on eBay" drift and re-apply the same deduction again
  // — repeating on every poll until the queue job finally catches up. This
  // was found live as a real order's stock ticking down by 1 every cycle.
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
      { $set: { ebay_synced_quantity: result.totalStockAfter } },
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
  fetchPopulatedRecord,
  findRecord,
  ensureRecord,
  adjustStock,
  setStock,
  getHistory,
  getTotalStockForProductVariant,
  getTotalStockForProduct,
  resolveSkuToIds,
  adjustStockForSku,
  adjustStockBySku,
};
