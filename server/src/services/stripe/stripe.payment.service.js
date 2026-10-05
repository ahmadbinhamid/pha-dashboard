// services/stripe/stripe.payment.service.js

const Payment = require("../../models/Payment");
const Tenant = require("../../models/Tenant");
const stripeKeysService = require("./stripe.keys.service");
const { getAmountDueForOrder } = require("../payment.service");
const { PAYMENT_PROVIDER, PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_STATUS } = require("../../constants/order.constants");
const { PAYMENT_DOMAIN_MODE } = require("../../constants/tenant.constants");
const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { formatOrderNumber } = require("../../utils/orderNumberFormat");

// Bills the balance due; reuses a pending intent so reloads add no Payment.
async function createPaymentIntentForOrder(order) {
  if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIALLY_PAID].includes(order.status)) {
    throw Object.assign(new Error("This order can no longer be paid"), { status: 409 });
  }

  const tenant = await Tenant.findById(order.tenant_id);
  if (!tenant?.stripe_publishable_key) {
    throw Object.assign(new Error("This store has not added its Stripe keys yet"), { status: 409 });
  }
  const stripe = await stripeKeysService.getStripeClient(order.tenant_id);
  const publishableKey = tenant.stripe_publishable_key;

  const remainingCents = await getAmountDueForOrder(order);
  if (remainingCents <= 0) {
    throw Object.assign(new Error("Order is already paid"), { status: 409 });
  }

  let payment = await Payment.findOne({ order: order._id }).sort({ created_at: -1 });

  if (
    payment &&
    payment.stripe_payment_intent_id &&
    [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REQUIRES_ACTION].includes(payment.status)
  ) {
    if (payment.amount === remainingCents) {
      const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
      if (!["canceled", "succeeded"].includes(intent.status)) {
        return { payment, client_secret: intent.client_secret, stripe_publishable_key: publishableKey };
      }
    } else {
      // Balance changed since this intent; cancel it and mint a fresh one.
      try {
        await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
      } catch (err) {
        if (err.code !== "payment_intent_unexpected_state") throw err;
        logger.warn(
          `[stripe.payment] intent ${payment.stripe_payment_intent_id} already in a terminal state, skipping cancel`,
        );
      }
      payment.status = PAYMENT_STATUS.CANCELED;
      await payment.save();
    }
  }

  const currency = order.currency || config.stripe.currency;

  const intent = await stripe.paymentIntents.create(
    {
      amount: remainingCents,
      currency,
      metadata: { order_id: order._id.toString(), order_number: formatOrderNumber(order.order_number_prefix, order.order_number) },
    },
    // Keyed by amount so a re-mint doesn't collide with the prior attempt.
    { idempotencyKey: `order_${order._id.toString()}_create_intent_${remainingCents}` },
  );

  try {
    payment = await Payment.create({
      tenant_id: order.tenant_id,
      order: order._id,
      provider: PAYMENT_PROVIDER.STRIPE,
      stripe_payment_intent_id: intent.id,
      amount: remainingCents,
      currency,
      status: PAYMENT_STATUS.PENDING,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Lost a create race; the idempotency key gave both the same intent.
    payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  }

  order.payment = payment._id;
  await order.save();

  // client_secret is never persisted; BYOK needs no Connect account.
  return { payment, client_secret: intent.client_secret, stripe_publishable_key: publishableKey };
}

// Host follows payment_domain_mode; VENDOR_SLUG falls back to DEFAULT.
function buildPaymentBaseUrl(tenant) {
  const domain = config.payment.linkDomain;
  // Outside production the payment host can't serve, so use CLIENT_URL.
  if (!domain || config.env !== "production") return config.emailBrand.clientUrl;

  // Hyphens stripped only here; subdomains read better with them.
  const host =
    tenant?.payment_domain_mode === PAYMENT_DOMAIN_MODE.VENDOR_SLUG && tenant.slug
      ? `${tenant.slug.replace(/-/g, "")}.${domain}`
      : `payment.${domain}`;
  return `https://${host}`;
}

// Link to the shared pay page; it creates the intent via the guest token.
function createPaymentLinkForOrder(order, tenant) {
  if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIALLY_PAID].includes(order.status)) {
    throw Object.assign(new Error("This order can no longer be paid"), { status: 409 });
  }
  if (!order.guest_access_token) {
    throw Object.assign(new Error("This order is missing its guest access token"), { status: 500 });
  }

  const url = `${buildPaymentBaseUrl(tenant)}/pay/${order._id}?token=${order.guest_access_token}`;
  return { url };
}

module.exports = { createPaymentIntentForOrder, createPaymentLinkForOrder, buildPaymentBaseUrl };
