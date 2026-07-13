// models/EbayProcessedOrder.js

const mongoose = require("mongoose");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

const schema = new mongoose.Schema(
  {
    platform: { type: String, default: MARKETPLACE_PLATFORM.EBAY },
    orderId: { type: String, required: true },
    // 'deduction' = stock taken out for a sale; 'restock' = stock returned for cancel/return
    action: { type: String, enum: ["deduction", "restock"], default: "deduction" },
    source: { type: String, enum: ["poller", "webhook"], default: "poller" },
    lineItems: [{ sku: String, quantity: Number }],
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

// Atomic uniqueness: one deduction + one restock allowed per platform + orderId
schema.index({ platform: 1, orderId: 1, action: 1 }, { unique: true });

module.exports = mongoose.model("EbayProcessedOrder", schema);
