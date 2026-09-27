// models/ChannelProcessedEvent.js
// Idempotency ledger for inbound marketplace order events (formerly EbayProcessedOrder).

const mongoose = require("mongoose");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

const schema = new mongoose.Schema(
  {
    platform: { type: String, default: MARKETPLACE_PLATFORM.EBAY },
    orderId: { type: String, required: true },
    // One doc per line item, not per order — eBay notifies per SKU on multi-item orders; keying dedup on orderId alone silently dropped later SKUs. Found live.
    sku: { type: String, required: true },
    quantity: { type: Number, default: null },
    // 'deduction' = stock taken out for a sale; 'restock' = stock returned for cancel/return
    action: { type: String, enum: ["deduction", "restock"], default: "deduction" },
    source: { type: String, enum: ["poller", "webhook"], default: "poller" },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

// Atomic uniqueness: one deduction + one restock per platform+orderId+SKU, so a 2-SKU order gets independent slots instead of racing.
schema.index({ platform: 1, orderId: 1, sku: 1, action: 1 }, { unique: true });

// NOTE: intentionally legacy collection name — renaming it would need a data migration.
const LEGACY_COLLECTION = "ebayprocessedorders";

module.exports = mongoose.model("ChannelProcessedEvent", schema, LEGACY_COLLECTION);
