// models/Refund.js
// Additive rewrite: the new scope/lines/payment_allocations shape is added alongside the old
// fields, not in place of them, until the orchestration rewrite and deprecated-shim removal land.
// refund_number/scope/total_amount/gst_amount are `required: true` only because
// scripts/backfillRefundRedesign.js has already run --write against this DB. Deployment
// ordering matters: run that backfill in every environment before this schema reaches it.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { REFUND_REASON, REFUND_STATUS } = require("../constants/refund.constants");

// One line per refunded order item, snapshotting what was refunded so a credit note stays
// accurate even if the order's items change later. _id: false since these are never individually
// addressed after creation.
const refundLineSchema = new Schema(
  {
    // References orderItemSchema's own _id. Not required yet at the Mongoose level, for the
    // same additive/no-behaviour-change reason as the top-level fields above.
    order_item_id: { type: Schema.Types.ObjectId, default: null },
    sku: { type: String, default: null },
    name: { type: String, default: null }, // snapshot, for the credit note

    quantity: { type: Number, default: null, min: 1 },

    // All derived server-side from the order at refund time, never accepted from the client.
    unit_price: { type: Number, default: null }, // cents, GST-inclusive
    // line_discount/order_discount_share are broken out separately, not folded into line_amount,
    // since the rounding-drift fix needs each item's own cumulative discount reconstructed later.
    line_discount: { type: Number, default: 0 }, // this item's own discount_amount, apportioned to refundQuantity
    order_discount_share: { type: Number, default: 0 }, // this line's share of order.discount_amount, this refund only
    line_amount: { type: Number, default: null }, // gross - line_discount - order_discount_share
    gst_amount: { type: Number, default: null }, // line_amount / 11, rounded (or exact residual — see §3.3)

    restock: { type: Boolean, default: false },
    restock_applied_at: { type: Date, default: null },
    ebay_sync_status: {
      type: String,
      enum: ["not_applicable", "pending", "synced", "failed"],
      default: "not_applicable",
    },
    ebay_sync_error: { type: String, default: null },
  },
  { _id: false },
);

// Which Payment doc(s) the money comes off; multiple entries when a refund spans several payments.
const paymentAllocationSchema = new Schema(
  {
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    amount: { type: Number, default: null }, // cents
    provider: { type: String, default: null }, // snapshot of payment.provider
    // Deliberately no `default: null` — must be a real id or genuinely absent, never explicit
    // null, since sparse only excludes an absent path and a null here would collide across
    // manual/eBay allocations. Every write site must omit this key, not null it. Confirmed live.
    stripe_refund_id: { type: String },
    // A manual/eBay allocation needs no async confirmation, so it's settled immediately; a
    // Stripe allocation starts false and flips true only once the webhook confirms success.
    // applyRefundEffects only runs once every allocation is settled, not just one of several.
    settled: { type: Boolean, default: true },
  },
  { _id: false },
);

const refundSchema = buildSchema({
  // Backfilled via scripts/backfillTenantId.js; every unique/partial index below is compound with this.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },

  // ── Existing fields — untouched, still read/written directly by refund.service.js and stripe files.
  payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
  order: { type: Schema.Types.ObjectId, ref: "Order", required: true },

  stripe_refund_id: { type: String, default: null }, // null until Stripe confirms creation
  amount: { type: Number, required: true }, // cents

  reason: {
    type: String,
    enum: Object.values(REFUND_REASON),
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(REFUND_STATUS),
    default: REFUND_STATUS.PENDING,
  },
  failure_reason: { type: String, default: null },

  // How this Refund came to exist: "admin_api" via our own endpoint, "stripe_dashboard"
  // reconciled from a webhook we didn't already know about (issued directly on Stripe), or
  // "manual" for a non-Stripe payment with no gateway call.
  initiated_via: {
    type: String,
    enum: ["admin_api", "stripe_dashboard", "manual"],
    default: "admin_api",
  },
  // Admin user who triggered the refund; null for "stripe_dashboard" refunds.
  initiated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },

  // ── New — additive, all optional/defaulted for now (see file header).
  payment_allocations: { type: [paymentAllocationSchema], default: [] },

  refund_number: { type: String, required: true }, // "CN-00001", via Counter

  scope: {
    type: String,
    enum: ["full_order", "line_items", "amount"],
    required: true,
  },
  lines: { type: [refundLineSchema], default: [] },

  shipping_amount: { type: Number, default: 0 }, // cents, >= 0
  adjustment_amount: { type: Number, default: 0 }, // signed: + goodwill, - restocking fee

  // total_amount = sum(lines.line_amount) + shipping_amount + adjustment_amount
  items_amount: { type: Number, required: true, default: 0 },
  gst_amount: { type: Number, required: true, default: 0 }, // see refund-calculator for the drift/residual rule
  total_amount: { type: Number, required: true, min: 1 },

  internal_note: { type: String, default: null },

  // Set once, by applyRefundEffects — marks that the restock/eBay leg was attempted, not a
  // correctness guard on money (money is derived state, always safe to recompute).
  effects_applied_at: { type: Date, default: null },

  // Client-supplied per refund attempt. Replaces the partial unique index on {payment, status:
  // pending} below, which false-positives on concurrent refunds of different products; that
  // index stays until the new endpoint is fully live.
  idempotency_key: { type: String, default: null },

  // Set when handleChargeRefunded reconciles a stripe_refund_id it didn't already know (issued
  // directly on the Stripe dashboard) — badges it as unallocated since there's no line data.
  needs_reconciliation: { type: Boolean, default: false },

  // An eBay-channel refund is bookkeeping only — no gateway call — and restocking pushes the
  // SKU quantity back up on the live eBay listing. If the admin hasn't actually issued the
  // refund in Seller Hub, that push is a lie. Required true whenever any allocation is eBay.
  ebay_refund_confirmed: { type: Boolean, default: false },

  // Reversal trail for a refund that failed after succeeding, or a mistaken manual refund.
  // Never hard-delete a Refund.
  voided_at: { type: Date, default: null },
  voided_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  void_reason: { type: String, default: null },
});

// ── Existing indexes, plus one correction: the legacy top-level stripe_refund_id had no index
// at all, so two concurrent charge.refunded deliveries could both insert a duplicate Refund.
// Checked the live DB first: 6 existing refunds, zero duplicates, safe to add now.
// partialFilterExpression, not sparse — the field's default is null (present), not unset, so
// sparse alone would still throw E11000; $type actually excludes null values. Same reasoning
// applies to idempotency_key and refund_number below.
refundSchema.index(
  { tenant_id: 1, stripe_refund_id: 1 },
  { unique: true, partialFilterExpression: { stripe_refund_id: { $type: "string" } } },
);

refundSchema.index({ payment: 1 }, { name: "payment_1" });

// Backstops the read-then-act pending check against a genuine concurrent double-submit race —
// at most one "pending" Refund per payment at the DB level. Dropped once idempotency_key is fully live.
refundSchema.index(
  { tenant_id: 1, payment: 1 },
  {
    name: "payment_1_pending_unique",
    unique: true,
    partialFilterExpression: { status: REFUND_STATUS.PENDING },
  },
);

// ── New indexes — all on new fields, none can collide with the old two above.
// { order: 1, status: 1 } backs applyRefundEffects' ledger recompute.
refundSchema.index({ order: 1, created_at: -1 });
refundSchema.index({ order: 1, status: 1 });
refundSchema.index({ "payment_allocations.payment": 1 });
// partialFilterExpression, not sparse — some existing allocations have stripe_refund_id stored
// as literal null (legacy data), and sparse only excludes a fully-absent field, not explicit null.
refundSchema.index(
  { tenant_id: 1, "payment_allocations.stripe_refund_id": 1 },
  { unique: true, partialFilterExpression: { "payment_allocations.stripe_refund_id": { $type: "string" } } },
);
// partialFilterExpression, not sparse — same reasoning as stripe_refund_id above: both fields
// default to null, not unset, so sparse alone wouldn't exclude them on the next old-code save.
refundSchema.index(
  { tenant_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
);
refundSchema.index(
  { tenant_id: 1, refund_number: 1 },
  { unique: true, partialFilterExpression: { refund_number: { $type: "string" } } },
);

module.exports = model("Refund", refundSchema);
