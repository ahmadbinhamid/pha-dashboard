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
  // set this field) don't collide on the unique index.
  stripe_payment_intent_id: {
    type: String,
    unique: true,
    sparse: true,
    required: function () {
      return this.provider === PAYMENT_PROVIDER.STRIPE;
    },
  },

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
