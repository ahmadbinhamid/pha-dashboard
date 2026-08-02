// models/Order.js
//
// All monetary fields are integer cents (AUD), matching Stripe's native unit —
// never floats, to keep GST-extraction and totals math exact.

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
    // Snapshot at time of order — never re-read from Product at display time,
    // so historical orders stay accurate if price/name changes later.
    name: { type: String, required: true },
    sku: { type: String, default: null },
    unit_price: { type: Number, required: true }, // cents, GST-inclusive
    quantity: { type: Number, required: true, min: 1 },
    // Per-line discount (cents) — set at creation by admin-created manual
    // orders (storefront/eBay orders always leave this at 0 at creation), and
    // editable after the fact on eBay/manual orders via
    // order.service.js#updateOrderItemDiscount.
    discount_amount: { type: Number, default: 0 },
    // Customer-facing note about this specific line (e.g. "no engine oil
    // included") — captured by staff when building a manual order.
    note: { type: String, default: null },

    // Price-edit audit trail — eBay/manual orders only (storefront prices are
    // never reopened after the fact, see order.service.js#updateOrderItemPrice).
    // original_unit_price is set once, on the first edit, so it always
    // reflects what was originally charged even if the price is edited more
    // than once afterward.
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

    // refund-redesign-spec.md §1.1 — cumulative, derived state (see
    // refund.service.js#applyRefundEffects once §3.7 lands): recomputed by
    // summing every succeeded Refund's lines for this item and assigned
    // absolutely, never incremented — the same pattern
    // stripe.webhook.service.js#handleChargeRefunded already uses correctly
    // for payment.amount_refunded. Additive only for now: nothing writes
    // these yet, they just sit at their defaults until §6.2's backfill and
    // the orchestration rewrite (§3.7) start populating them.
    quantity_refunded: { type: Number, default: 0, min: 0 },
    amount_refunded: { type: Number, default: 0, min: 0 }, // cents, this line's share only
    // Tracked separately from quantity_refunded because restock is opt-in
    // per refund line — refunding 2 units with restock unchecked must never
    // later be mistaken for units that came back into stock.
    quantity_restocked: { type: Number, default: 0, min: 0 },
  },
  {
    // §1.1: refund lines need a stable per-item reference that survives
    // regardless of array position — index-based addressing (see
    // order.service.js#updateOrderItemPrice/#updateOrderItemDiscount, still
    // index-addressed and unaffected by this) breaks the moment items are
    // ever reordered or removed. NOTE: this does not retroactively give
    // historical items a persisted _id — see the §6.2 backfill and Order's
    // own item_ids_migrated_at below for why POST /orders/:orderId/refunds
    // must check that flag rather than trusting item._id's mere presence
    // (Mongoose auto-generates one in memory on read even when nothing was
    // ever actually persisted).
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// refund_calculator.service.js (§3) is the actual source of truth for what a
// refund may take — this virtual exists so nothing else (a controller, a
// frontend view) has to reimplement "quantity minus already-refunded" by
// hand and risk drifting from that.
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
  // Backfilled onto every existing Order by scripts/backfillTenantId.js —
  // order_number/invoice_number/external_order_id's unique indexes below are
  // compound with this.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  order_number: { type: String, required: true }, // e.g. "PHA-00001"
  // Separate sequence from order_number, minted at the same time — orders
  // and invoices are 1:1 today, but this keeps the financial/tax-invoice
  // document number independent of the operational order reference, since
  // they diverge the moment partial shipments, credit notes, or consolidated
  // billing exist. See scripts/migrateInvoiceNumbers.js for backfill.
  invoice_number: { type: String, required: true }, // e.g. "INV-00001"
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
  // not added on top. total = subtotal - discount_amount + shipping_cost.
  subtotal: { type: Number, required: true },
  // Legacy order-level manual adjustment (goodwill credit, negotiated
  // discount) — distinct from each line item's own discount_amount, which is
  // baked into subtotal already. Zero at creation on every channel. No
  // longer editable after the fact (discounts are now applied per line item
  // via order.service.js#updateOrderItemDiscount instead) — this field is
  // kept only so historical orders that already had one keep reconciling
  // correctly against their stored `total`.
  discount_amount: { type: Number, required: true, default: 0 },
  shipping_cost: { type: Number, required: true, default: 0 },
  tax_amount: { type: Number, required: true }, // GST extracted from subtotal, display-only
  total: { type: Number, required: true },
  currency: { type: String, required: true, default: "aud" },

  // Deprecated (refund-redesign-spec.md §1.2/§9) — mixes payment state and
  // fulfilment state in one enum, which is exactly why
  // finalizeSucceededRefund used to overwrite FULFILLED with REFUNDED.
  // Stays authoritative until the §6.2 backfill populates payment_status/
  // fulfillment_status below for every existing order and the services that
  // read `status` are migrated to read those instead (§9) — do not read or
  // write payment_status/fulfillment_status yet, they're additive-only at
  // this point and every order will have them at their defaults.
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
    default: ORDER_FULFILLMENT_STATUS.UNFULFILLED,
  },

  // Set by the §6.2 backfill script once every item on this order has a
  // real, persisted _id (orderItemSchema was `{ _id: false }` before this
  // change — see that schema's own comment). Deliberately NOT inferred by
  // checking item._id's presence at read time: Mongoose auto-generates an
  // in-memory _id for an `{ _id: true }` subdocument on every hydrate, even
  // when nothing was ever actually persisted, so item._id looks "present"
  // on an unmigrated order too. POST /orders/:orderId/refunds (§2.2) must
  // check this flag directly for scope: line_items | full_order and fail
  // loud with "order needs migration" rather than trust item shape.
  item_ids_migrated_at: { type: Date, default: null },

  // Per-order mutex for POST /order/:id/refunds (§3.1/§9's concurrency fix).
  // Validation is read-then-act (refundable_quantity, remaining money) —
  // the derived-state ledger makes effect APPLICATION idempotent but does
  // nothing for admission: two concurrent requests can both read the same
  // pre-refund refundable_quantity, both pass validation, both insert. This
  // lock serializes admission per order. The staleness window (checked by
  // refund.service.js#acquireRefundLock, not encoded here) lets a crashed
  // request's lock be reclaimed rather than wedging the order permanently.
  refund_lock_at: { type: Date, default: null },
  // Fencing token (corrections round), paired with refund_lock_at. Without
  // this, a holder whose critical section outlasted the staleness window
  // would have its lock reclaimed by a new caller, and the original
  // holder's own release (in a `finally`) would then clear the NEW
  // holder's lock out from under it — reopening the exact admission race
  // this field exists to prevent. Generated fresh per acquisition; release
  // only clears the lock when the token still matches, so a stale holder's
  // release harmlessly no-ops instead of clobbering whoever holds it now.
  refund_lock_token: { type: String, default: null },

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
orderSchema.index({ tenant_id: 1, order_number: 1 }, { unique: true });
orderSchema.index({ tenant_id: 1, invoice_number: 1 }, { unique: true });
// partialFilterExpression, NOT sparse — many existing (storefront) orders
// have external_order_id stored as literal null rather than absent, and
// sparse only excludes a field that's entirely unset. Unique (per tenant) so
// a re-poll of the same eBay order can never create a duplicate.
orderSchema.index(
  { tenant_id: 1, external_order_id: 1 },
  { unique: true, partialFilterExpression: { external_order_id: { $type: "string" } } },
);
// Backs the per-tenant order list view (default sort: newest first).
orderSchema.index({ tenant_id: 1, created_at: -1 });

module.exports = model("Order", orderSchema);
