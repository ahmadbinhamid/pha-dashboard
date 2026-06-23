// models/EbayProcessedOrder.js

const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    lineItems: [{ sku: String, quantity: Number }],
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

module.exports = mongoose.model("EbayProcessedOrder", schema);
