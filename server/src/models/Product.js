// models/Product.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
} = require("../constants/product.constants");
const { SHIPPING_METHOD } = require("../constants/shipping.constants");

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

// Staff-only note thread, never shown to customers; mirrors Order.js.
const internalNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const productSchema = buildSchema({
  // Slug's unique index below is compound with this.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String },
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
  // standard: shipping_cost per unit; calculated: Transdirect by postcode.
  shipping_method: { type: String, enum: Object.values(SHIPPING_METHOD), default: SHIPPING_METHOD.STANDARD },
  // Transdirect only: courier brings a tailgate lift (no forklift on site).
  tailgate_pickup: { type: Boolean, default: false },
  tailgate_delivery: { type: Boolean, default: false },
  // Shelf/bin where the item sits, e.g. "A3-02"; printed on its tag.
  bay: { type: String, default: null, trim: true, maxlength: 40 },
  // Packed size (cm) and weight (kg); channels use it unless overridden.
  package: {
    length: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    weight: { type: Number, default: null },
  },
  is_taxable: { type: Boolean, default: false },
  sku: { type: String, default: null },
  barcode: { type: String, default: null },
  stock_control: { type: Boolean, default: true },
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
  // Default fitment: Technical Specifications, eBay aspects, search facets.
  vehicle: { type: vehicleSchema, default: () => ({}) },
  additional_fitments: { type: [vehicleSchema], default: [] },
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

productSchema.index({ tenant_id: 1, slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { sparse: true });
// Partial, not sparse: sku is stored as null, which sparse still indexes.
productSchema.index(
  { tenant_id: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string" } } },
);
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ "vehicle.make": 1, "vehicle.model": 1, "vehicle.model_code": 1 });
productSchema.index({ "additional_fitments.make": 1, "additional_fitments.model": 1, "additional_fitments.model_code": 1 });
// getProductCountsByCategory; autoIndex is off in prod, so build it manually.
productSchema.index({ tenant_id: 1, categories: 1, is_published_online: 1, status: 1 });

// Pickup-only products never post, so no stale flat rate can be charged.
productSchema.pre("validate", function clearPickupShippingCost() {
  if (this.shipping_method === SHIPPING_METHOD.PICKUP) this.shipping_cost = null;
});

module.exports = model("Product", productSchema);
