// models/EbayProcessedOrder.js

const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    // 'deduction' = stock taken out for a sale; 'restock' = stock returned for cancel/return
    action: { type: String, enum: ["deduction", "restock"], default: "deduction" },
    source: { type: String, enum: ["poller", "webhook"], default: "poller" },
    lineItems: [{ sku: String, quantity: Number }],
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Atomic uniqueness: one deduction + one restock allowed per orderId
schema.index({ orderId: 1, action: 1 }, { unique: true });

module.exports = mongoose.model("EbayProcessedOrder", schema);
