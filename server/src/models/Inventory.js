// models/Inventory.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const inventorySchema = buildSchema(
  {
    // NOTE: optional until backfillInventoryTenantId runs; reads still use product.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
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

// One record per product+variant+location.
inventorySchema.index(
  { product: 1, variant: 1, location: 1 },
  { unique: true },
);
// Tenant-wide stock aggregates and product/variant filters, once reads move.
inventorySchema.index({ tenant_id: 1, product: 1, variant: 1 });

module.exports = model("Inventory", inventorySchema);
