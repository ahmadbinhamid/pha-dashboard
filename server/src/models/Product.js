// models/Product.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  EBAY_SYNC_STATUS,
} = require("../constants/product.constants");

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
  // TODO(marketplace): these eBay fields should move to a separate
  // MarketplaceListing collection when adding Amazon/Shopify/Daraz etc.
  // Schema: { product, variant, platform, listing_id, sync_status, synced_at }
  ebay_listing_id: { type: String, default: null },
  ebay_offer_id: { type: String, default: null },
  ebay_category_id: { type: String, default: null },
  ebay_condition: { type: String, default: "NEW" },
  ebay_sync_status: {
    type: String,
    enum: Object.values(EBAY_SYNC_STATUS),
    default: EBAY_SYNC_STATUS.NOT_LISTED,
  },
  ebay_synced_at: { type: Date, default: null },
});

productSchema.index({ sku: 1 }, { sparse: true });

module.exports = model("Product", productSchema);
