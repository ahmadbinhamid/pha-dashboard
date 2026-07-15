// models/Order.js
//
// All monetary fields are integer cents (AUD), matching Stripe's native unit —
// never floats, to keep GST-extraction and totals math exact.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ORDER_STATUS } = require("../constants/order.constants");

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    // Snapshot at time of order — never re-read from Product at display time,
    // so historical orders stay accurate if price/name changes later.
    name: { type: String, required: true },
    sku: { type: String, default: null },
    unit_price: { type: Number, required: true }, // cents, GST-inclusive
    quantity: { type: Number, required: true, min: 1 },

    // Tracks whether this line item's quantity change (sale or restock) has
    // been pushed to eBay. "not_applicable" covers SKUs with no inventory
    // record / no eBay listing. A failed push is retried via the eBay queue;
    // this field stays visible on the order for manual reconciliation if it
    // never recovers.
    ebay_sync_status: {
      type: String,
      enum: ["not_applicable", "pending", "synced", "failed"],
      default: "not_applicable",
    },
    ebay_sync_error: { type: String, default: null },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    address: { type: String, required: true },
    suburb: { type: String, required: true },
    state: { type: String, required: true },
    postcode: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = buildSchema({
  order_number: { type: String, required: true, unique: true }, // e.g. "PHA-00001"
  items: { type: [orderItemSchema], required: true },

  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
  },
  shipping_address: { type: addressSchema, required: true },
  billing_address: { type: addressSchema, default: null }, // null => same as shipping

  // Cents, GST-inclusive prices throughout (AU retail convention):
  // subtotal already includes GST; tax_amount is informational (subtotal / 11),
  // not added on top. total = subtotal + shipping_cost.
  subtotal: { type: Number, required: true },
  shipping_cost: { type: Number, required: true, default: 0 },
  tax_amount: { type: Number, required: true }, // GST extracted from subtotal, display-only
  total: { type: Number, required: true },
  currency: { type: String, required: true, default: "aud" },

  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING_PAYMENT,
  },

  payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },

  // Set once at creation, required to fetch this order from the public
  // GET /orders/:id endpoint — never returned again after order creation.
  guest_access_token: { type: String, required: true, select: false },

  // Set by the payment-success webhook if stock was insufficient at the
  // point of decrement; surfaced to admins for manual reconciliation.
  has_stock_issue: { type: Boolean, default: false },
  stock_issue_note: { type: String, default: null },
});

orderSchema.index({ "customer.email": 1 });
orderSchema.index({ status: 1 });

module.exports = model("Order", orderSchema);
