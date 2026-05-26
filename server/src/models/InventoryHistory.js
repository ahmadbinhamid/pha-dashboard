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
    adjustment: { type: Number, required: true },
    stock_before: { type: Number, required: true },
    stock_after: { type: Number, required: true },
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

module.exports = model("InventoryHistory", inventoryHistorySchema);
