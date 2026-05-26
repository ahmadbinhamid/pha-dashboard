// models/Product.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const choiceSchema = new Schema(
  {
    name: { type: String },
    items: [{ type: String }],
  },
  { _id: false },
);

const productSchema = buildSchema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, default: "" },
  type: {
    type: Number,
    enum: [1, 2], // 1=physical, 2=digital
    default: 1,
  },
  status: {
    type: Number,
    enum: [0, 1], // 0=draft, 1=active
    default: 0,
  },
  is_published_online: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  compare_price: { type: Number, default: null },
  cost_price: { type: Number, default: null },
  is_taxable: { type: Boolean, default: false },
  is_vat_inclusive: { type: Boolean, default: false },
  vat_rate: { type: Number, default: null },
  sku: { type: String, default: null },
  barcode: { type: String, default: null },
  stock_control: { type: Boolean, default: false },
  has_variants: { type: Boolean, default: false },
  brand: { type: String, default: null },
  attachments: [{ type: Schema.Types.ObjectId, ref: "Attachment" }],
  categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  tags: [{ type: String }],
  related_products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  choices: [choiceSchema],
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
  ebay_synced_at: { type: Date, default: null },
});

productSchema.index({ slug: 1 });

module.exports = model("Product", productSchema);
