// models/Payment.js
// Amounts are integer cents. stripe_client_secret is deliberately not a field — returned once
// from the create-intent response and never persisted.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { PAYMENT_PROVIDER, PAYMENT_METHOD, PAYMENT_STATUS } = require("../constants/payment.constants");

const paymentSchema = buildSchema({
  // Backfilled via scripts/backfillTenantId.js; stripe_payment_intent_id's unique index is compound with this.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  provider: {
    type: String,
    enum: Object.values(PAYMENT_PROVIDER),
    default: PAYMENT_PROVIDER.STRIPE,
  },
  // Only Stripe payments have one; uniqueness/partial-filtering handled by the compound index below.
  stripe_payment_intent_id: {
    type: String,
    required: function () {
      return this.provider === PAYMENT_PROVIDER.STRIPE;
    },
  },

  // Human-facing detail for manual payments; always null for Stripe (inherently a card).
  payment_method: {
    type: String,
    enum: [...Object.values(PAYMENT_METHOD), null],
    default: null,
  },

  amount: { type: Number, required: true }, // cents
  amount_refunded: { type: Number, default: 0 }, // cents
  currency: { type: String, required: true, default: "aud" },

  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
  },

  card_brand: { type: String, default: null },
  card_last4: { type: String, default: null },
  failure_reason: { type: String, default: null },
  paid_at: { type: Date, default: null },

  // Set only after the order/stock side of handlePaymentSucceeded completes, distinct from
  // status === SUCCEEDED (saved earlier) — lets a webhook retry resume instead of getting stuck. Found live.
  order_effects_applied_at: { type: Date, default: null },
});

// Covers payment.service.js's { order } lookups sorted by created_at, and a plain { order } query too.
paymentSchema.index({ order: 1, created_at: -1 });
// partialFilterExpression, not sparse — some docs store this as literal null, and sparse only
// excludes an absent field, not an explicit null. $type excludes both (see Refund.js).
paymentSchema.index(
  { tenant_id: 1, stripe_payment_intent_id: 1 },
  { unique: true, partialFilterExpression: { stripe_payment_intent_id: { $type: "string" } } },
);

module.exports = model("Payment", paymentSchema);
