// models/Product.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
} = require("../constants/product.constants");

const choiceSchema = new Schema(
  {
    name: { type: String },
    items: [{ type: String }],
  },
  { _id: false },
);

const vehicleSchema = new Schema(
  {
    make: { type: String, default: null },
    model: { type: String, default: null },
    model_code: { type: String, default: null },
    year_from: { type: Number, default: null },
    year_to: { type: Number, default: null },
  },
  { _id: false },
);

// Internal staff comment thread — never shown to customers. Mirrors
// Order.js's internalNoteSchema exactly.
const internalNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const productSchema = buildSchema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, default: "" },
  type: {
    type: String,
    enum: Object.values(PRODUCT_TYPE),
    default: PRODUCT_TYPE.PHYSICAL,
  },
  status: {
    type: String,
    enum: Object.values(PRODUCT_STATUS),
    default: PRODUCT_STATUS.DRAFT,
  },
  is_published_online: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  compare_price: { type: Number, default: null },
  cost_price: { type: Number, default: null },
  shipping_cost: { type: Number, default: null },
  is_taxable: { type: Boolean, default: false },
  sku: { type: String, default: null },
  barcode: { type: String, default: null },
  stock_control: { type: Boolean, default: false },
  has_variants: { type: Boolean, default: false },
  brand: { type: String, default: null },
  mpn: { type: String, default: null, trim: true },
  condition: {
    type: String,
    enum: Object.values(PRODUCT_CONDITION),
    default: PRODUCT_CONDITION.NEW,
  },
  authenticity: {
    type: String,
    enum: Object.values(PRODUCT_AUTHENTICITY),
    default: null,
  },
  vehicle: { type: vehicleSchema, default: () => ({}) },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  rating_count: { type: Number, default: 0, min: 0 },
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
  internal_notes: { type: [internalNoteSchema], default: [] },
});

productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ "vehicle.make": 1, "vehicle.model": 1, "vehicle.model_code": 1 });

module.exports = model("Product", productSchema);
