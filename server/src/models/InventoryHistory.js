// models/InventoryHistory.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

const inventoryHistorySchema = buildSchema(
  {
    // NOTE: optional until backfillInventoryTenantId runs; reads still use product.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
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
    // Unapplied part of `adjustment` once stock_after clamps at 0.
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
// Dashboard activity range-filters by created_at before its $lookup.
inventoryHistorySchema.index({ created_at: -1 });
// The same dashboard queries once they filter on tenant_id directly.
inventoryHistorySchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("InventoryHistory", inventoryHistorySchema);
