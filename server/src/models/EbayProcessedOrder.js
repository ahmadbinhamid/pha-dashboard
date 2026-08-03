// models/EbayProcessedOrder.js

const mongoose = require("mongoose");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

const schema = new mongoose.Schema(
  {
    platform: { type: String, default: MARKETPLACE_PLATFORM.EBAY },
    orderId: { type: String, required: true },
    // One document per line item, not per order — eBay sends a separate
    // ORDER.LINE_ITEMS_CREATED/UPDATED notification per SKU on a multi-item
    // order (see ebay.webhook.service.js), and the poller processes every
    // line item of a polled order in one pass. Keying the dedup ledger on
    // orderId alone meant the SECOND SKU's notification (or the poller's own
    // per-order claim, racing a webhook that already claimed the order) hit
    // the same unique key and was silently dropped as "already processed" —
    // permanently skipping that SKU's stock deduction/restock. Found live.
    sku: { type: String, required: true },
    quantity: { type: Number, default: null },
    // 'deduction' = stock taken out for a sale; 'restock' = stock returned for cancel/return
    action: { type: String, enum: ["deduction", "restock"], default: "deduction" },
    source: { type: String, enum: ["poller", "webhook"], default: "poller" },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

// Atomic uniqueness: one deduction + one restock allowed per platform +
// orderId + SKU — so a 2-SKU order claims two independent slots instead of
// racing each other (or the poller) for one.
schema.index({ platform: 1, orderId: 1, sku: 1, action: 1 }, { unique: true });

module.exports = mongoose.model("EbayProcessedOrder", schema);
