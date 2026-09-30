// models/Order.js
// Money is integer cents (AUD), Stripe's native unit, never floats.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  ORDER_STATUS,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_PAYMENT_STATUS,
  ORDER_FULFILLMENT_STATUS,
} = require("../constants/order.constants");
const { ADDRESS_TYPE } = require("../constants/shipping.constants");

const orderItemSchema = new Schema(
  {
    // Custom lines are order-only, never catalogue products, so no product.
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      required: function () {
        return !this.is_custom;
      },
    },
    // NOTE: revert breaks saves once custom lines exist; docs/custom-order-lines.md
    is_custom: { type: Boolean, default: false },
    variant: { type: Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    // Snapshot at order time, so later product edits don't rewrite history.
    name: { type: String, required: true },
    sku: { type: String, default: null },
    unit_price: { type: Number, required: true }, // cents, GST-inclusive
    quantity: { type: Number, required: true, min: 1 },
    // Per-line discount (cents); editable later on eBay/manual orders.
    discount_amount: { type: Number, default: 0 },
    // Customer-facing line note, added by staff on manual orders.
    note: { type: String, default: null },

    // Price-edit audit; original_unit_price is set once, on the first edit.
    original_unit_price: { type: Number, default: null },
    unit_price_updated_at: { type: Date, default: null },
    unit_price_updated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // eBay quantity push state; a failure stays visible for reconciliation.
    ebay_sync_status: {
      type: String,
      enum: ["not_applicable", "pending", "synced", "failed"],
      default: "not_applicable",
    },
    ebay_sync_error: { type: String, default: null },

    // Recomputed from succeeded refunds and assigned, never incremented.
    quantity_refunded: { type: Number, default: 0, min: 0 },
    amount_refunded: { type: Number, default: 0, min: 0 }, // cents, this line's share only
    // Separate: restock is opt-in per refund line, not implied by refunds.
    quantity_restocked: { type: Number, default: 0, min: 0 },
  },
  {
    // Stable ids for refund lines; old items rely on item_ids_migrated_at.
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// One definition of what's left to refund; refund-calculator has the rules.
orderItemSchema.virtual("refundable_quantity").get(function () {
  return this.quantity - this.quantity_refunded;
});

const addressSchema = new Schema(
  {
    address: { type: String, required: true },
    suburb: { type: String, required: true },
    state: { type: String, required: true },
    postcode: { type: String, required: true },
    // Residential or business; what calculated shipping was quoted for.
    address_type: { type: String, enum: [...Object.values(ADDRESS_TYPE), null], default: null },
  },
  { _id: false },
);

// Staff comment thread, separate from the customer-facing `note`.
const internalNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const orderSchema = buildSchema({
  // Unique indexes below are per tenant.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  // Bare sequence; the prefix is snapshotted so old orders never relabel.
  order_number: { type: String, required: true },
  order_number_prefix: { type: String, required: true, default: "ORD" },
  // Own sequence: invoices will diverge from orders (credit notes etc.).
  invoice_number: { type: String, required: true },
  invoice_number_prefix: { type: String, required: true, default: "INV" },
  items: { type: [orderItemSchema], required: true },

  // Contact details optional: walk-in customers may have none on file.
  customer: {
    name: { type: String, required: true },
    // Shown on the invoice instead of `name` when present.
    company_name: { type: String, trim: true, default: null },
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
  },
  // Null for guests; `customer` above stays what was shown and emailed.
  customer_id: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
  // eBay orders are always delivery; only the storefront offers pickup.
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

  // Customer-facing order note, set once; staff notes live below.
  note: { type: String, default: null },
  internal_notes: { type: [internalNoteSchema], default: [] },

  // GST-inclusive: total = subtotal - discount_amount + shipping_cost.
  subtotal: { type: Number, required: true },
  // Legacy order-level discount, kept so old orders still add up.
  discount_amount: { type: Number, required: true, default: 0 },
  shipping_cost: { type: Number, required: true, default: 0 },
  tax_amount: { type: Number, required: true }, // GST extracted from subtotal, display-only
  total: { type: Number, required: true },
  currency: { type: String, required: true, default: "aud" },

  // Legacy rollup of the payment_status and fulfillment_status fields below.
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

  // Item ids are persisted; Mongoose invents in-memory ids, so check this.
  item_ids_migrated_at: { type: Date, default: null },

  // Per-order refund lock; validation is read-then-act, so it must serialise.
  refund_lock_at: { type: Date, default: null },
  // Fencing token: a stale holder's release can't free someone else's lock.
  refund_lock_token: { type: String, default: null },

  // Origin channel; every channel's orders share this collection.
  channel: {
    type: String,
    enum: Object.values(ORDER_CHANNEL),
    default: ORDER_CHANNEL.STOREFRONT,
  },
  // Channel's own order id (null for storefront); stops duplicate imports.
  external_order_id: { type: String },
  // The channel's buyer identifier when it doesn't expose a real name/email.
  external_buyer_username: { type: String, default: null },
  // Full raw payload snapshot for audit/debugging. Not returned by default.
  external_raw_payload: { type: Schema.Types.Mixed, default: null, select: false },

  payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },

  // Guest access to GET /orders/:id; returned only in the create response.
  guest_access_token: { type: String, required: true, select: false },

  // Set by the payment webhook when stock ran short at decrement.
  has_stock_issue: { type: Boolean, default: false },
  stock_issue_note: { type: String, default: null },

  // Set on fulfilling a delivery order; always null for pickup.
  tracking_number: { type: String, default: null },
  carrier_name: { type: String, default: null },
  // Free-form customer/staff reference, not the order or invoice number.
  reference_number: { type: String, default: null },
});

// New orders have real item ids, or refunds would demand a migration.
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
// Partial, not sparse: storefront orders store a literal null here.
orderSchema.index(
  { tenant_id: 1, external_order_id: 1 },
  { unique: true, partialFilterExpression: { external_order_id: { $type: "string" } } },
);
// Backs the per-tenant order list view (default sort: newest first).
orderSchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("Order", orderSchema);
