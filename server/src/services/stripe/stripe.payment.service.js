// services/stripe/stripe.payment.service.js

const Payment = require("../../models/Payment");
const { getStripeClient } = require("./stripe.client.service");
const { PAYMENT_PROVIDER, PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_STATUS } = require("../../constants/order.constants");
const config = require("../../config");

// Creates (or reuses) a PaymentIntent for an order. Reuses an existing
// pending intent instead of minting a new one on every call — otherwise a
// reloaded payment page would create a fresh Payment doc each time. The
// idempotency key additionally protects the very first create call against
// duplicate network retries.
async function createPaymentIntentForOrder(order) {
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    throw Object.assign(new Error("This order can no longer be paid"), { status: 409 });
  }

  const stripe = getStripeClient();

  let payment = await Payment.findOne({ order: order._id }).sort({ created_at: -1 });

  if (payment && payment.status === PAYMENT_STATUS.SUCCEEDED) {
    throw Object.assign(new Error("Order is already paid"), { status: 409 });
  }

  if (payment && [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REQUIRES_ACTION].includes(payment.status)) {
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    return { payment, client_secret: intent.client_secret };
  }

  const currency = order.currency || config.stripe.currency;

  const intent = await stripe.paymentIntents.create(
    {
      amount: order.total,
      currency,
      metadata: { order_id: order._id.toString(), order_number: order.order_number },
    },
    { idempotencyKey: `order_${order._id.toString()}_create_intent` },
  );

  try {
    payment = await Payment.create({
      order: order._id,
      provider: PAYMENT_PROVIDER.STRIPE,
      stripe_payment_intent_id: intent.id,
      amount: order.total,
      currency,
      status: PAYMENT_STATUS.PENDING,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Lost a race with a concurrent create-intent call for the same order
    // (duplicate request, double-click, or a dev double-invoke) — Stripe's
    // idempotency key already returned the same PaymentIntent to both
    // callers, so the winner's Payment doc is authoritative; reuse it.
    payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  }

  order.payment = payment._id;
  await order.save();

  // client_secret is returned here only — never persisted to Mongo.
  return { payment, client_secret: intent.client_secret };
}

module.exports = { createPaymentIntentForOrder };
