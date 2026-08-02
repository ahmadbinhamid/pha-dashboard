// models/Refund.js
//
// refund-redesign-spec.md §1.3 — additive rewrite (Phase 1 of §6's migration
// order). Every field/index that existed before this change is untouched
// below, since refund.service.js, stripe.refund.service.js, and
// stripe.webhook.service.js still read/write them directly and Phase 1 must
// ship with no behaviour change. The new scope/lines/payment_allocations
// shape (§2, §3) is added alongside, not in place of, the old one — the old
// fields only go away once the orchestration rewrite (§3.7) and the
// deprecated-shim removal (§9) actually land.
//
// refund_number/scope/total_amount/gst_amount are now `required: true` (§6.2)
// — scripts/backfillRefundRedesign.js has been run in --write mode against
// this DB and every existing Refund document carries real values for all
// four (verified: zero documents matching `{scope: {$exists: false}}` after
// the run). DEPLOYMENT ORDERING MATTERS: this only stays safe as long as the
// backfill runs before this tightened schema is live anywhere a Refund might
// get re-saved — deploying this code to an environment that hasn't been
// backfilled yet reproduces the exact crash this same relaxation avoided in
// Phase 1 (Mongoose validates required fields on every .save(), including
// old-shape documents). Run the backfill script first, in every environment,
// before this commit reaches it.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { REFUND_REASON, REFUND_STATUS } = require("../constants/refund.constants");

// §1.3 — one line per refunded order item, snapshotting what was refunded so
// a credit note stays accurate even if the order's own items change later.
// _id: false (unlike orderItemSchema) since these are never individually
// addressed after creation — order_item_id is the reference *into* the
// order, not an identity refund lines themselves need.
const refundLineSchema = new Schema(
  {
    // References orderItemSchema's own _id (see Order.js — now `{ _id: true }`
    // per §1.1). Not required yet at the Mongoose level for the same
    // additive/no-behaviour-change reason as the top-level fields above —
    // nothing constructs a refundLineSchema entry until §3/§4 land, so this
    // is inert until then regardless.
    order_item_id: { type: Schema.Types.ObjectId, default: null },
    sku: { type: String, default: null },
    name: { type: String, default: null }, // snapshot, for the credit note

    quantity: { type: Number, default: null, min: 1 },

    // All derived server-side from the order at refund time — never
    // accepted from the client. See refund-redesign-spec.md §3.2.
    unit_price: { type: Number, default: null }, // cents, GST-inclusive
    // line_discount and order_discount_share are broken out separately
    // (not just folded into line_amount) because the rounding-drift fix
    // needs to reconstruct each item's OWN cumulative discount already
    // refunded across prior refunds (refund-calculator.service.js#lineDiscount's
    // exhaustion-residual check) — line_amount alone can't be decomposed
    // back into "how much of this was item-level discount vs order-level
    // discount share" after the fact.
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

// §1.3 — which Payment doc(s) the money comes off. Multiple entries when one
// refund spans a deposit + a card payment; sum of allocations === total_amount.
const paymentAllocationSchema = new Schema(
  {
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    amount: { type: Number, default: null }, // cents
    provider: { type: String, default: null }, // snapshot of payment.provider
    // Deliberately NO `default: null` — this field must be either a real
    // Stripe refund id or genuinely ABSENT from the subdocument, never an
    // explicit null. It backs a unique index (below): `sparse` only excludes
    // an array element where the path is absent, not one where it's
    // present-but-null, so a manual/eBay allocation with an explicit null
    // here would collide with every other manual allocation's null the
    // moment two of them exist — confirmed live: the backfill script
    // (scripts/backfillRefundRedesign.js) hit exactly this constructing
    // allocations with `stripe_refund_id: null` for non-Stripe refunds.
    // Every write site (this backfill, and refund.service.js from §3
    // onward) must omit this key entirely for a manual/eBay allocation
    // rather than set it to null.
    stripe_refund_id: { type: String },
    // §4/§6 — a manual/eBay allocation needs no async confirmation, so it's
    // considered settled the moment the refund is created (order.service.js
    // sets this true up front for those). A Stripe allocation starts false
    // and flips true only once charge.refunded/charge.refund.updated
    // confirms sr.status === "succeeded" — applyRefundEffects only runs once
    // EVERY allocation on the refund is settled, not just one of several
    // (a refund can span a manual deposit + a Stripe top-up, each settling
    // independently).
    settled: { type: Boolean, default: true },
  },
  { _id: false },
);

const refundSchema = buildSchema({
  // Backfilled onto every existing Refund by scripts/backfillTenantId.js —
  // every unique/partial index below is compound with this.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },

  // ── Existing fields — untouched, still read/written by the current
  // refund.service.js / stripe.refund.service.js / stripe.webhook.service.js.
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

  // How this Refund doc came to exist:
  //  - "admin_api": created by our own POST /payment/:id/refund endpoint (Stripe)
  //  - "stripe_dashboard": reconciled from a charge.refunded webhook whose
  //    stripe_refund_id we didn't already know — i.e. issued directly from
  //    the Stripe dashboard, bypassing our API entirely
  //  - "manual": staff recorded a refund for a non-Stripe (cash/online
  //    transfer/EFPOS) payment via POST /payment/:id/refund-manual — no
  //    gateway call, the amount is just handed back outside the system
  initiated_via: {
    type: String,
    enum: ["admin_api", "stripe_dashboard", "manual"],
    default: "admin_api",
  },
  // Admin user who triggered the refund — null for "stripe_dashboard" refunds,
  // since no admin in our system initiated those.
  initiated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },

  // ── New (§1.3) — additive, all optional/defaulted for now (see file header).
  payment_allocations: { type: [paymentAllocationSchema], default: [] },

  refund_number: { type: String, required: true }, // "CN-00001", via Counter — see §6.2

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
  gst_amount: { type: Number, required: true, default: 0 }, // see §3.3 for the drift/residual rule
  total_amount: { type: Number, required: true, min: 1 },

  internal_note: { type: String, default: null },

  // Set once, by applyRefundEffects (§3.7) — a marker that the restock/eBay
  // leg has been attempted for this refund, NOT a correctness guard on
  // money (money is derived state under the revised §3.7, always safe to
  // recompute regardless of this flag).
  effects_applied_at: { type: Date, default: null },

  // Client-supplied per refund attempt (§2.2, §3.1.7). Replaces the partial
  // unique index on {payment, status: pending} below, which false-positives
  // on legitimate concurrent refunds of different products and collides
  // with dashboard reconciliation — that index stays for now (still backing
  // the current createRefund's double-submit guard) and is dropped only
  // once the new endpoint is live (§6.3).
  idempotency_key: { type: String, default: null },

  // §4.1 — set when handleChargeRefunded reconciles a stripe_refund_id it
  // didn't already know (issued directly from the Stripe dashboard, bypassing
  // our API) — lets RefundHistoryList.tsx badge it as unallocated, since a
  // dashboard refund carries no line data telling us which products came back.
  needs_reconciliation: { type: Boolean, default: false },

  // §5 — an eBay-channel payment settles through eBay Managed Payments, so a
  // refund against it is bookkeeping only: there is no gateway call, and
  // restocking pushes the SKU's quantity back UP on the live eBay listing.
  // If the admin hasn't actually issued the refund in eBay Seller Hub yet,
  // that restock push is a lie — stock rises locally and on eBay while the
  // sale (and eBay's own cut) still stands. Required true (validated in
  // refund.validation.js, enforced in refund.service.js#createRefund)
  // whenever any payment_allocations entry has provider: "ebay"; stored here
  // as the acknowledgement record, not just a transient request flag.
  ebay_refund_confirmed: { type: Boolean, default: false },

  // Reversal trail (§3.8) for a refund that failed after succeeding, or a
  // mistaken manual refund. Never hard-delete a Refund.
  voided_at: { type: Date, default: null },
  voided_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  void_reason: { type: String, default: null },
});

// ── Existing indexes — untouched, PLUS one correction: the legacy top-level
// stripe_refund_id (still the field handleChargeRefunded writes today —
// migrating writers to payment_allocations.stripe_refund_id is Phase 6) had
// NO index at all until now, unique or otherwise. Two concurrent
// charge.refunded deliveries can both miss the same refund id via the
// existing findOne-then-create in handleChargeRefunded and both insert a
// Refund for it — exactly the race the new payment_allocations index (below)
// was meant to close, except that index is on a field nothing writes to yet.
// Checked the live DB first: 6 existing refunds carry a non-null
// stripe_refund_id, zero duplicates among them, so this is safe to add now
// rather than a data-cleanup prerequisite. Kept until §9, dropped only when
// the legacy field itself is removed.
//
// partialFilterExpression, NOT sparse: `sparse` only excludes documents
// where the field is entirely ABSENT — it does nothing for a document that
// has the field explicitly set to null, which is exactly what happens here
// since the field's own schema default is `null`, not "unset". Verified
// against the live DB: `sparse: true` here throws E11000 on `{stripe_refund_id:
// null}` immediately, because most existing refunds already have it
// persisted as literal null (from being saved at least once under the
// pre-existing `default: null` on this same field, long before this change).
// The $type filter is the only thing that actually excludes null values, not
// just missing ones. Same reasoning applies below to idempotency_key and
// refund_number — both are also nullable scalars, not just newly-added ones.
refundSchema.index(
  { tenant_id: 1, stripe_refund_id: 1 },
  { unique: true, partialFilterExpression: { stripe_refund_id: { $type: "string" } } },
);

refundSchema.index({ payment: 1 }, { name: "payment_1" });

// Backstops the read-then-act pending check in stripe.refund.service.js
// (createRefund) against a genuine concurrent double-submit race — at most
// one "pending" Refund per payment can exist at the database level. Dropped
// per §6.3 once idempotency_key is live end-to-end, not before.
refundSchema.index(
  { tenant_id: 1, payment: 1 },
  {
    name: "payment_1_pending_unique",
    unique: true,
    partialFilterExpression: { status: REFUND_STATUS.PENDING },
  },
);

// ── New indexes (§1.3) — all on new fields, none can collide with the old
// two above. { order: 1, status: 1 } backs applyRefundEffects' ledger
// recompute (§3.7) — one indexed query per invocation.
refundSchema.index({ order: 1, created_at: -1 });
refundSchema.index({ order: 1, status: 1 });
refundSchema.index({ "payment_allocations.payment": 1 });
// Sparse is correct here ONLY because paymentAllocationSchema.stripe_refund_id
// has no `default: null` (see that schema, just above) — an empty
// payment_allocations array contributes zero keys regardless of sparse/
// partial, but a NON-empty array with an explicit null in one of its
// entries very much does collide, sparse or not: confirmed live, the first
// version of this schema (with a null default on that field) threw E11000
// the moment two manual-only refunds' allocations both indexed a null. As
// long as every write site omits the key entirely for a non-Stripe
// allocation instead of nulling it, sparse is sufficient and correct.
// partialFilterExpression, NOT sparse — some existing allocations have
// stripe_refund_id stored as literal null rather than omitted (legacy data,
// likely from a raw-driver migration bypassing Mongoose validation), and
// sparse doesn't exclude an explicit null, only a fully-absent field.
refundSchema.index(
  { tenant_id: 1, "payment_allocations.stripe_refund_id": 1 },
  { unique: true, partialFilterExpression: { "payment_allocations.stripe_refund_id": { $type: "string" } } },
);
// partialFilterExpression, NOT sparse — same reasoning as stripe_refund_id
// above: both fields default to null, not "unset", so sparse alone doesn't
// exclude them once any existing Refund is next saved by old code that
// knows nothing about these new fields (finalizeSucceededRefund's
// refund.save(), handleChargeRefunded's existing.save()) and picks up the
// default. Confirmed no live document currently has either set yet, but
// that's exactly why this had to be fixed now, before the first such save
// makes it a live 500 the moment a second one follows.
refundSchema.index(
  { tenant_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
);
refundSchema.index(
  { tenant_id: 1, refund_number: 1 },
  { unique: true, partialFilterExpression: { refund_number: { $type: "string" } } },
);

module.exports = model("Refund", refundSchema);
