// services/stripe/stripe.payment-guard.service.js
// Before an order edit: no live payment in flight, and any open intent closed.

const Payment = require("../../models/Payment");
const stripeKeysService = require("./stripe.keys.service");
const { logger } = require("../../loaders/logging");
const { httpError } = require("../../utils/http/httpError");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_EDIT_CONFLICT } = require("../../constants/order.constants");
const { INTENT_STATUSES_BLOCKING_EDIT, INTENT_STATUSES_CANCELLABLE } = require("../../constants/stripe.constants");

const PAYMENT_IN_FLIGHT_MESSAGE = "A payment has been received or is in progress for this order.";

const conflict = (code, message) => httpError(message, 409, { code });

// Stripe's live status is the truth; the stored Payment may lag the webhook.
async function retrieveLiveIntent(tenantId, intentId) {
  try {
    const stripe = await stripeKeysService.getStripeClient(tenantId);
    return { stripe, intent: await stripe.paymentIntents.retrieve(intentId) };
  } catch (err) {
    logger.warn(`[stripe.payment-guard] could not retrieve intent ${intentId}: ${err.message}`);
    throw conflict(ORDER_EDIT_CONFLICT.PAYMENT_CHECK_FAILED, "Couldn't confirm this order's payment status with Stripe. Try again.");
  }
}

/** Rejects (409) if money moved or is moving; else cancels any open intent. */
async function releaseOpenPaymentIntent(order) {
  const payment = await Payment.findOne({ order: order._id, stripe_payment_intent_id: { $ne: null } }).sort({ created_at: -1 });
  if (!payment) return;

  const intentId = payment.stripe_payment_intent_id;
  const { stripe, intent } = await retrieveLiveIntent(order.tenant_id, intentId);
  if (intent.status === "canceled") return;
  if (INTENT_STATUSES_BLOCKING_EDIT.includes(intent.status)) {
    throw conflict(ORDER_EDIT_CONFLICT.PAYMENT_IN_FLIGHT, PAYMENT_IN_FLIGHT_MESSAGE);
  }
  // NOTE: an unrecognised status could be money moving, so it blocks too.
  if (!INTENT_STATUSES_CANCELLABLE.includes(intent.status)) {
    throw conflict(ORDER_EDIT_CONFLICT.PAYMENT_IN_FLIGHT, PAYMENT_IN_FLIGHT_MESSAGE);
  }

  // NOTE: any cancel failure blocks, unlike intent creation: it may be a payment.
  let cancelled;
  try {
    cancelled = await stripe.paymentIntents.cancel(intentId);
  } catch (err) {
    logger.warn(`[stripe.payment-guard] cancel failed for intent ${intentId}: ${err.code ?? ""} ${err.message}`);
    throw conflict(ORDER_EDIT_CONFLICT.PAYMENT_IN_FLIGHT, PAYMENT_IN_FLIGHT_MESSAGE);
  }
  if (cancelled?.status !== "canceled") throw conflict(ORDER_EDIT_CONFLICT.PAYMENT_IN_FLIGHT, PAYMENT_IN_FLIGHT_MESSAGE);

  // Only with Stripe's confirmation in hand is the Payment marked cancelled.
  await Payment.updateOne({ _id: payment._id }, { $set: { status: PAYMENT_STATUS.CANCELED } });
}

module.exports = { releaseOpenPaymentIntent };
