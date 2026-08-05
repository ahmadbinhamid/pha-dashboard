// services/stripe/stripe.payment.service.js

const Payment = require("../../models/Payment");
const Tenant = require("../../models/Tenant");
const stripeKeysService = require("./stripe.keys.service");
const { getTotalPaidForOrder } = require("../payment.service");
const { PAYMENT_PROVIDER, PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_STATUS } = require("../../constants/order.constants");
const { PAYMENT_DOMAIN_MODE } = require("../../constants/tenant.constants");
const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { formatOrderNumber } = require("../../utils/orderNumberFormat");

// Creates (or reuses) a PaymentIntent for an order, for whatever balance is
// still outstanding — not necessarily the full order.total, since a manual
// sale may already have a deposit (or an earlier top-up) on file. Reuses an
// existing pending intent instead of minting a new one on every call —
// otherwise a reloaded payment page would create a fresh Payment doc each
// time. The idempotency key additionally protects the very first create call
// against duplicate network retries.
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

  const totalPaidCents = await getTotalPaidForOrder(order._id);
  const remainingCents = order.total - totalPaidCents;
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
      // The outstanding balance changed since this intent was created (e.g.
      // a manual top-up was recorded while the customer had the payment
      // page open) — cancel it rather than let them pay a stale amount, and
      // fall through to mint a fresh intent for the correct remainder.
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
    // Scoped to the remaining balance, not just the order — a stale-amount
    // cancel-and-recreate (above) must not collide with the prior attempt's
    // idempotency key, since Stripe rejects reusing a key with different params.
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
    // Lost a race with a concurrent create-intent call for the same order
    // (duplicate request, double-click, or a dev double-invoke) — Stripe's
    // idempotency key already returned the same PaymentIntent to both
    // callers, so the winner's Payment doc is authoritative; reuse it.
    payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  }

  order.payment = payment._id;
  await order.save();

  // client_secret is returned here only — never persisted to Mongo.
  // stripe_publishable_key (this tenant's own, not secret) is what the
  // caller needs to initialize Stripe.js (loadStripe(publishableKey)) to
  // confirm this intent — BYOK means no Connect account-context is needed.
  return { payment, client_secret: intent.client_secret, stripe_publishable_key: publishableKey };
}

// Same dashboard page (/pay/:orderId) either way — this only changes the
// host in the URL bar/email, per the tenant's payment_domain_mode. VENDOR_SLUG
// falls back to DEFAULT's shared host if PAYMENT_LINK_DOMAIN isn't set
// (local dev) or the tenant somehow has no slug yet.
function buildPaymentBaseUrl(tenant) {
  const domain = config.payment.linkDomain;
  if (!domain) return config.emailBrand.clientUrl;

  // tenant.slug keeps its hyphens everywhere else (DB, tenant_slug login,
  // etc) — stripped only here, since a subdomain like
  // parts-hub-australia.autopartspro.au reads worse than partshubaustralia.
  const host =
    tenant?.payment_domain_mode === PAYMENT_DOMAIN_MODE.VENDOR_SLUG && tenant.slug
      ? `${tenant.slug.replace(/-/g, "")}.${domain}`
      : `payment.${domain}`;
  return `https://${host}`;
}

// Builds a link to the shared, platform-hosted payment page (lives in this
// dashboard app at /pay/:orderId — NOT any tenant's own storefront, since a
// payment link is just "pay this specific amount", not a shopping
// experience, and building/maintaining that page once per tenant storefront
// deployment would be pure duplication). No Stripe object is created here at
// all — that page creates (or reuses) the PaymentIntent itself via the exact
// same guest POST /payment/create-intent endpoint the normal storefront
// checkout uses (see createPaymentIntentForOrder above), keyed off the
// order's own guest_access_token. That keeps this one code path — and its
// webhook handling — the single source of truth for turning a Stripe
// payment into a paid order, regardless of whether the order came from a
// tenant's storefront or this admin-generated link.
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
