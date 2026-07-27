// models/Order.js
//
// All monetary fields are integer cents (AUD), matching Stripe's native unit —
// never floats, to keep GST-extraction and totals math exact.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ORDER_STATUS, ORDER_CHANNEL, ORDER_DELIVERY_METHOD } = require("../constants/order.constants");

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
    // Per-line discount (cents) — only ever set by admin-created manual
    // orders today; storefront/eBay orders always leave this at 0.
    discount_amount: { type: Number, default: 0 },
    // Customer-facing note about this specific line (e.g. "no engine oil
    // included") — captured by staff when building a manual order.
    note: { type: String, default: null },

    // Price-edit audit trail — storefront/eBay orders only (see
    // order.service.js#updateOrderItemPrice; manual orders price at creation
    // via discount_amount instead). original_unit_price is set once, on the
    // first edit, so it always reflects what was originally charged even if
    // the price is edited more than once afterward.
    original_unit_price: { type: Number, default: null },
    unit_price_updated_at: { type: Date, default: null },
    unit_price_updated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },

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

// Internal staff comment thread — distinct from `note` (customer-facing,
// captured once at order creation): these accumulate over time, each
// attributed to whichever admin wrote it.
const internalNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const orderSchema = buildSchema({
  order_number: { type: String, required: true, unique: true }, // e.g. "PHA-00001"
  // Separate sequence from order_number, minted at the same time — orders
  // and invoices are 1:1 today, but this keeps the financial/tax-invoice
  // document number independent of the operational order reference, since
  // they diverge the moment partial shipments, credit notes, or consolidated
  // billing exist. See scripts/migrateInvoiceNumbers.js for backfill.
  invoice_number: { type: String, required: true, unique: true }, // e.g. "INV-00001"
  items: { type: [orderItemSchema], required: true },

  // Required for storefront/eBay orders (enforced by their own request
  // validation) but optional here — a manual/walk-in Customer record may
  // have no email or phone on file.
  customer: {
    name: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
  },
  // Link to the Customer collection, when this order belongs to a known
  // customer record — null for guest storefront checkouts, which only ever
  // populate the snapshot above. `customer` above stays the source of truth
  // for what was actually shown/emailed at order time even if the linked
  // Customer record is later edited.
  customer_id: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
  // How the order reaches the customer. eBay orders are always DELIVERY
  // (imported with a real shipping_address); only storefront checkout lets
  // the customer choose PICKUP.
  delivery_method: {
    type: String,
    enum: Object.values(ORDER_DELIVERY_METHOD),
    default: ORDER_DELIVERY_METHOD.DELIVERY,
  },
  // Required for DELIVERY, null for PICKUP — there's nowhere to ship.
  shipping_address: {
    type: addressSchema,
    default: null,
    required: function () {
      return this.delivery_method !== ORDER_DELIVERY_METHOD.PICKUP;
    },
  },
  billing_address: { type: addressSchema, default: null }, // null => same as shipping

  // Customer-facing note for the whole order (e.g. a special request called
  // out at checkout) — captured once, at creation. Distinct from
  // `internal_notes` below, which is an ongoing staff comment thread.
  note: { type: String, default: null },
  internal_notes: { type: [internalNoteSchema], default: [] },

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

  // Which channel this order came from — orders live in one unified
  // collection regardless of origin, this just tags where each one is from.
  channel: {
    type: String,
    enum: Object.values(ORDER_CHANNEL),
    default: ORDER_CHANNEL.STOREFRONT,
  },
  // The channel's own order ID (e.g. eBay's orderId) — null for storefront
  // orders. Used to detect an order we've already imported on re-poll.
  external_order_id: { type: String },
  // The channel's buyer identifier (e.g. eBay username) when the channel
  // doesn't expose a real name/email the way our own checkout requires.
  external_buyer_username: { type: String, default: null },
  // Full snapshot of the raw payload the channel sent us, for audit/debugging
  // when the mapped fields above don't look right. Not returned by default.
  external_raw_payload: { type: Schema.Types.Mixed, default: null, select: false },

  payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },

  // Set once at creation, required to fetch this order from the public
  // GET /orders/:id endpoint — never returned again after order creation.
  guest_access_token: { type: String, required: true, select: false },

  // Set by the payment-success webhook if stock was insufficient at the
  // point of decrement; surfaced to admins for manual reconciliation.
  has_stock_issue: { type: Boolean, default: false },
  stock_issue_note: { type: String, default: null },

  // Set together when an admin fulfils a DELIVERY order — capturing one
  // without the other isn't meaningful, so both are written in the same
  // update (see order.service.js#sendOrderNotification). Always null for
  // PICKUP orders, which have nothing to hand off to a carrier.
  tracking_number: { type: String, default: null },
  carrier_name: { type: String, default: null },
});

orderSchema.index({ "customer.email": 1 });
orderSchema.index({ customer_id: 1 });
orderSchema.index({ status: 1 });
// Sparse so storefront orders (no external_order_id) don't collide on null;
// unique so a re-poll of the same eBay order can never create a duplicate.
orderSchema.index({ external_order_id: 1 }, { unique: true, sparse: true });

module.exports = model("Order", orderSchema);
