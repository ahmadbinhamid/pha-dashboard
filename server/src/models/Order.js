// models/Order.js
// All monetary fields are integer cents (AUD), matching Stripe's native unit, never floats.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  ORDER_STATUS,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_PAYMENT_STATUS,
  ORDER_FULFILLMENT_STATUS,
} = require("../constants/order.constants");

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    // Snapshot at order time; never re-read from Product, so historical orders stay accurate.
    name: { type: String, required: true },
    sku: { type: String, default: null },
    unit_price: { type: Number, required: true }, // cents, GST-inclusive
    quantity: { type: Number, required: true, min: 1 },
    // Per-line discount (cents), set at creation by manual orders; editable after the fact on
    // eBay/manual orders via updateOrderItemDiscount.
    discount_amount: { type: Number, default: 0 },
    // Customer-facing note about this line, captured by staff when building a manual order.
    note: { type: String, default: null },

    // Price-edit audit trail, eBay/manual orders only. original_unit_price is set once, on the
    // first edit, so it always reflects what was originally charged.
    original_unit_price: { type: Number, default: null },
    unit_price_updated_at: { type: Date, default: null },
    unit_price_updated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Whether this line's quantity change has been pushed to eBay. A failed push is retried
    // via the eBay queue; this stays visible for manual reconciliation if it never recovers.
    ebay_sync_status: {
      type: String,
      enum: ["not_applicable", "pending", "synced", "failed"],
      default: "not_applicable",
    },
    ebay_sync_error: { type: String, default: null },

    // Cumulative, derived state: recomputed by summing every succeeded Refund's lines for this
    // item and assigned absolutely, never incremented (same pattern as payment.amount_refunded).
    quantity_refunded: { type: Number, default: 0, min: 0 },
    amount_refunded: { type: Number, default: 0, min: 0 }, // cents, this line's share only
    // Tracked separately since restock is opt-in per refund line, never assumed from quantity_refunded.
    quantity_restocked: { type: Number, default: 0, min: 0 },
  },
  {
    // Refund lines need a stable per-item reference that survives regardless of array position.
    // Doesn't retroactively give historical items a persisted _id — see item_ids_migrated_at
    // below for why refund creation must check that flag, not just item._id's presence.
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// refund-calculator.service.js is the actual source of truth for what a refund may take; this
// virtual exists so nothing else reimplements "quantity minus already-refunded" and risks drifting.
orderItemSchema.virtual("refundable_quantity").get(function () {
  return this.quantity - this.quantity_refunded;
});

const addressSchema = new Schema(
  {
    address: { type: String, required: true },
    suburb: { type: String, required: true },
    state: { type: String, required: true },
    postcode: { type: String, required: true },
  },
  { _id: false },
);

// Internal staff comment thread, distinct from `note` (customer-facing, set once at creation).
const internalNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const orderSchema = buildSchema({
  // Backfilled via scripts/backfillTenantId.js; the unique indexes below are compound with this.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  // Bare zero-padded sequence, never a prefix baked in; order_number_prefix below is snapshotted
  // once at creation, not looked up live, so changing the tenant setting never relabels past orders.
  order_number: { type: String, required: true },
  order_number_prefix: { type: String, required: true, default: "ORD" },
  // Separate sequence from order_number, minted at the same time, keeping the invoice document
  // number independent since they'll diverge once partial shipments/credit notes exist.
  invoice_number: { type: String, required: true },
  invoice_number_prefix: { type: String, required: true, default: "INV" },
  items: { type: [orderItemSchema], required: true },

  // Required for storefront/eBay orders (their own validation enforces it), optional here since
  // a manual/walk-in Customer record may have no email or phone on file.
  customer: {
    name: { type: String, required: true },
    // Shown on the invoice instead of `name` when present.
    company_name: { type: String, trim: true, default: null },
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
  },
  // Link to a known Customer record; null for guest checkouts. `customer` above stays the
  // source of truth for what was shown/emailed even if the linked record is later edited.
  customer_id: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
  // How the order reaches the customer; eBay orders are always DELIVERY, only storefront lets
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

  // Customer-facing note for the whole order, captured once at creation. Distinct from
  // `internal_notes` below, an ongoing staff comment thread.
  note: { type: String, default: null },
  internal_notes: { type: [internalNoteSchema], default: [] },

  // Cents, GST-inclusive prices throughout (AU retail convention):
  // subtotal already includes GST; tax_amount is informational (subtotal / 11),
  // not added on top. total = subtotal - discount_amount + shipping_cost.
  subtotal: { type: Number, required: true },
  // Legacy order-level manual adjustment, distinct from each line's own discount_amount (already
  // baked into subtotal). No longer editable — kept only so historical orders reconcile against `total`.
  discount_amount: { type: Number, required: true, default: 0 },
  shipping_cost: { type: Number, required: true, default: 0 },
  tax_amount: { type: Number, required: true }, // GST extracted from subtotal, display-only
  total: { type: Number, required: true },
  currency: { type: String, required: true, default: "aud" },

  // Legacy: mixes payment and fulfilment state in one enum, which is exactly why refunds used
  // to overwrite FULFILLED with REFUNDED. `payment_status`/`fulfillment_status` below are the
  // real independent fields; this is kept as a derived rollup for readers not yet migrated off it.
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING_PAYMENT,
  },
  payment_status: {
    type: String,
    enum: Object.values(ORDER_PAYMENT_STATUS),
    default: ORDER_PAYMENT_STATUS.PENDING_PAYMENT,
  },
  fulfillment_status: {
    type: String,
    enum: Object.values(ORDER_FULFILLMENT_STATUS),
    default: ORDER_FULFILLMENT_STATUS.PENDING,
  },

  // Set by the backfill script once every item has a real, persisted _id. Not inferred by
  // checking item._id's presence — Mongoose auto-generates one in memory on every hydrate even
  // when nothing was ever persisted, so refund creation must check this flag directly.
  item_ids_migrated_at: { type: Date, default: null },

  // Per-order mutex for refund creation. Validation is read-then-act, so two concurrent
  // requests could both pass and both insert without this lock serializing admission per order.
  refund_lock_at: { type: Date, default: null },
  // Fencing token paired with refund_lock_at, so a stale holder's release (after its lock was
  // reclaimed) harmlessly no-ops instead of clobbering whoever holds it now.
  refund_lock_token: { type: String, default: null },

  // Which channel this order came from; orders live in one unified collection regardless of origin.
  channel: {
    type: String,
    enum: Object.values(ORDER_CHANNEL),
    default: ORDER_CHANNEL.STOREFRONT,
  },
  // The channel's own order ID; null for storefront. Detects an order already imported on re-poll.
  external_order_id: { type: String },
  // The channel's buyer identifier when it doesn't expose a real name/email.
  external_buyer_username: { type: String, default: null },
  // Full raw payload snapshot for audit/debugging. Not returned by default.
  external_raw_payload: { type: Schema.Types.Mixed, default: null, select: false },

  payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },

  // Set once at creation, required for the public GET /orders/:id endpoint; never returned after that.
  guest_access_token: { type: String, required: true, select: false },

  // Set by the payment-success webhook if stock was insufficient at decrement time.
  has_stock_issue: { type: Boolean, default: false },
  stock_issue_note: { type: String, default: null },

  // Set together when an admin fulfils a DELIVERY order; always null for PICKUP orders.
  tracking_number: { type: String, default: null },
  carrier_name: { type: String, default: null },
  // Optional customer/staff-supplied reference, unrelated to the system-generated order/invoice numbers.
  reference_number: { type: String, default: null },
});

// Every order created after orderItemSchema switched to `{ _id: true }` already has real item
// ids; without this hook, only the one-time backfill script set item_ids_migrated_at, so any
// order created afterward would permanently fail the refund "needs migration" guard.
orderSchema.pre("save", function (next) {
  if (this.isNew && !this.item_ids_migrated_at) {
    this.item_ids_migrated_at = new Date();
  }
  next();
});

orderSchema.index({ "customer.email": 1 });
orderSchema.index({ customer_id: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ tenant_id: 1, order_number: 1 }, { unique: true });
orderSchema.index({ tenant_id: 1, invoice_number: 1 }, { unique: true });
// partialFilterExpression, not sparse — many storefront orders store external_order_id as
// literal null. Unique per tenant so a re-poll of the same eBay order can never duplicate.
orderSchema.index(
  { tenant_id: 1, external_order_id: 1 },
  { unique: true, partialFilterExpression: { external_order_id: { $type: "string" } } },
);
// Backs the per-tenant order list view (default sort: newest first).
orderSchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("Order", orderSchema);
