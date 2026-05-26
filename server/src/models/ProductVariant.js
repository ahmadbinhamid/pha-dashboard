// models/ProductVariant.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const combinationSchema = new Schema(
  {
    option: { type: String },
    value: { type: String },
  },
  { _id: false },
);

const productVariantSchema = buildSchema({
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  combination: [combinationSchema],
  display_name: { type: String, default: null },
  price: { type: Number, default: 0 },
  compare_price: { type: Number, default: null },
  cost_price: { type: Number, default: null },
  sku: { type: String, default: null },
  barcode: { type: String, default: null },
  is_active: { type: Boolean, default: true },
  attachments: [{ type: Schema.Types.ObjectId, ref: "Attachment" }],
  digital_file: {
    type: Schema.Types.ObjectId,
    ref: "Attachment",
    default: null,
  },
  ebay_listing_id: { type: String, default: null },
  ebay_sync_status: {
    type: String,
    enum: ["not_listed", "pending", "synced", "error"],
    default: "not_listed",
  },
});

module.exports = model("ProductVariant", productVariantSchema);
