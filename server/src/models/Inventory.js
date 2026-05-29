// models/Inventory.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const inventorySchema = buildSchema(
  {
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
    stock_count: { type: Number, default: 0 },
    stock_reserved: { type: Number, default: 0 },
  },
  { softDelete: false },
);

// Compound unique index: one record per product+variant+location combo
inventorySchema.index(
  { product: 1, variant: 1, location: 1 },
  { unique: true },
);

module.exports = model("Inventory", inventorySchema);
