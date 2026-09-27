// models/TagPrintLog.js
// One print run; items are snapshots so history survives product edits.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { TAG_PRINT_SOURCE } = require("../constants/tag.constants");

const printedItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, default: null },
    title: { type: String, required: true },
    bay: { type: String, default: null },
    copies: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const tagPrintLogSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    source: { type: String, enum: Object.values(TAG_PRINT_SOURCE), required: true },
    printed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    items: { type: [printedItemSchema], default: [] },
    total_tags: { type: Number, required: true, min: 1 },
  },
  { softDelete: false },
);

tagPrintLogSchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("TagPrintLog", tagPrintLogSchema);
