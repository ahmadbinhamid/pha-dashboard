// models/InventoryHistory.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

const inventoryHistorySchema = buildSchema(
  {
    inventory: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    adjustment: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "adjustment must be a whole number",
      },
    },
    stock_before: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "stock_before must be a whole number",
      },
    },
    stock_after: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "stock_after must be a whole number",
      },
    },
    // Portion of `adjustment` that couldn't apply (would go negative); stock_after clamps at 0 but adjustment keeps the true requested value. See inventory.service.js#adjustStock.
    clamped_shortfall: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "clamped_shortfall must be a whole number",
      },
    },
    reason: { type: String, default: null },
    type: {
      type: String,
      enum: Object.values(ADJUSTMENT_TYPE),
      default: ADJUSTMENT_TYPE.OTHER,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { softDelete: false },
);

// inventory.service.js#getHistory: { inventory }, sort by created_at desc.
inventoryHistorySchema.index({ inventory: 1, created_at: -1 });
// Lets dashboard.service.js's activity-log aggregation range-filter by created_at (pre-$lookup) use an index instead of a full scan.
inventoryHistorySchema.index({ created_at: -1 });

module.exports = model("InventoryHistory", inventoryHistorySchema);
