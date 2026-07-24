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

// Generates a Stripe-hosted Checkout link for an admin-created manual order
// whose staff member chose "payment link" instead of collecting cash/online
// transfer on the spot. Unlike createPaymentIntentForOrder, Stripe doesn't
// reliably hand back `session.payment_intent` synchronously from
// `checkout.sessions.create` — so the Payment doc is keyed primarily by
// `stripe_checkout_session_id` here, and `stripe_payment_intent_id` is
// filled in (if not already known) once `checkout.session.completed`
// arrives — see stripe.webhook.service.js#handleCheckoutSessionCompleted,
// which then reuses handlePaymentSucceeded exactly as the direct-intent flow does.
async function createPaymentLinkForOrder(order) {
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    throw Object.assign(new Error("This order can no longer be paid"), { status: 409 });
  }

  const stripe = getStripeClient();

  // Reuse an existing pending link's session rather than minting a new
  // PaymentIntent every time the button is clicked.
  const existingPayment = await Payment.findOne({ order: order._id }).sort({ created_at: -1 });
  if (existingPayment && existingPayment.status === PAYMENT_STATUS.SUCCEEDED) {
    throw Object.assign(new Error("Order is already paid"), { status: 409 });
  }
  if (
    existingPayment &&
    existingPayment.provider === PAYMENT_PROVIDER.STRIPE &&
    [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REQUIRES_ACTION].includes(existingPayment.status)
  ) {
    const session = await stripe.checkout.sessions.retrieve(existingPayment.stripe_checkout_session_id);
    if (session.status === "open") {
      return { url: session.url, payment: existingPayment };
    }
    // Expired/completed-without-webhook-yet session — fall through and mint a fresh one.
  }

  const currency = order.currency || config.stripe.currency;
  const returnUrl = `${config.emailBrand.storefrontUrl}/checkout/payment?order_id=${order._id}&token=${order.guest_access_token}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Order ${order.order_number}` },
            unit_amount: order.total,
          },
          quantity: 1,
        },
      ],
      success_url: returnUrl,
      cancel_url: returnUrl,
      metadata: { order_id: order._id.toString(), order_number: order.order_number },
    },
    { idempotencyKey: `order_${order._id.toString()}_create_payment_link` },
  );

  // `session.payment_intent` is included only when Stripe actually returns
  // it up front — explicitly omitted otherwise (never written as `null`),
  // since the field is sparse+unique and an explicit null still counts as
  // "present" for indexing purposes, which would collide with any other
  // pending payment-link Payment doc the same way the bare field once did.
  const paymentData = {
    order: order._id,
    provider: PAYMENT_PROVIDER.STRIPE,
    stripe_checkout_session_id: session.id,
    amount: order.total,
    currency,
    status: PAYMENT_STATUS.PENDING,
  };
  if (session.payment_intent) paymentData.stripe_payment_intent_id = session.payment_intent;

  let payment;
  try {
    payment = await Payment.create(paymentData);
  } catch (err) {
    if (err.code !== 11000) throw err;
    payment = await Payment.findOne({ stripe_checkout_session_id: session.id });
  }

  order.payment = payment._id;
  await order.save();

  return { url: session.url, payment };
}

module.exports = { createPaymentIntentForOrder, createPaymentLinkForOrder };
