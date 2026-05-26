// models/InventoryHistory.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

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
      enum: [
        "restock",
        "damaged",
        "lost",
        "stolen",
        "correction",
        "transfer_in",
        "transfer_out",
        "other",
      ],
      default: "other",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { softDelete: false }
);

module.exports = model("InventoryHistory", inventoryHistorySchema);
