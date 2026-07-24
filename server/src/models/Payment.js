// models/Payment.js
//
// Amounts are integer cents. stripe_client_secret is deliberately NOT a
// field here — it's returned once from the create-intent response and
// never persisted.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { PAYMENT_PROVIDER, PAYMENT_METHOD, PAYMENT_STATUS } = require("../constants/payment.constants");

const paymentSchema = buildSchema({
  order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  provider: {
    type: String,
    enum: Object.values(PAYMENT_PROVIDER),
    default: PAYMENT_PROVIDER.STRIPE,
  },
  // Only Stripe payments have one — sparse so manual payments (which never
  // set this field) don't collide on the unique index. A Checkout-Session
  // (payment link) Stripe payment is the one exception where this is
  // legitimately absent at creation time — Stripe doesn't always hand back
  // the underlying PaymentIntent id synchronously from
  // `checkout.sessions.create`, so it's filled in later once
  // checkout.session.completed arrives (see stripe.webhook.service.js).
  stripe_payment_intent_id: {
    type: String,
    unique: true,
    sparse: true,
    required: function () {
      return this.provider === PAYMENT_PROVIDER.STRIPE && !this.stripe_checkout_session_id;
    },
  },
  // Only set when this Payment was created via a generated payment link
  // (Checkout Session) rather than the storefront's direct PaymentIntent
  // flow — lets a repeat "Generate Payment Link" click retrieve/reuse the
  // same session instead of minting a new one.
  stripe_checkout_session_id: { type: String, default: null },

  // Human-facing detail for manual payments (cash, card terminal, bank
  // transfer, ...) — always null for Stripe, which is inherently a card.
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
});

paymentSchema.index({ order: 1 });

module.exports = model("Payment", paymentSchema);
