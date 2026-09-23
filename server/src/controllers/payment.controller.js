// controllers/payment.controller.js

const orderService = require("../services/order.service");
const paymentService = require("../services/payment.service");
const { createPaymentIntentForOrder } = require("../services/stripe/stripe.payment.service");
const { constructEventWithFallback, handleEvent } = require("../services/stripe/stripe.webhook.service");
const stripeKeysService = require("../services/stripe/stripe.keys.service");
const config = require("../config");
const { logger } = require("../loaders/logging");
const {
  success,
  created,
  notFound,
  badRequest,
  requestfailure,
  systemfailure,
} = require("../utils/http/response");

exports.createIntent = async (req, res) => {
  try {
    // Same guest-token gate as GET /orders/:id — generic 404 so a guessed order_id can't probe existence.
    const order = await orderService.getOrderForGuest(req.body.order_id, req.body.token, req.tenantId);

    const { payment, client_secret, stripe_publishable_key } = await createPaymentIntentForOrder(order);
    return created(res, { payment_id: payment._id, client_secret, stripe_publishable_key });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.listPayments = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const result = await paymentService.listPayments({ page, limit, skip, status: req.query.status }, req.tenantId);
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getPayment = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentWithRefunds(req.params.id, req.tenantId);
    if (!payment) return notFound(res, "Payment not found");
    return success(res, payment);
  } catch (err) {
    return systemfailure(res, err);
  }
};

// refundPayment/refundPaymentManual removed — use POST /order/:orderId/refunds instead.

// BYOK: each tenant's Stripe account delivers webhooks to this shared URL with an opaque `?wt=`
// token, resolved here before signature verification so the right tenant's secret is used.
exports.handleWebhook = async (req, res) => {
  const { wt } = req.query;
  if (!wt) return badRequest(res, "Missing wt");

  const resolved = await stripeKeysService.findByWebhookToken(wt);
  if (!resolved || !resolved.webhookSecret) return notFound(res, "Webhook not configured");
  const { tenant, webhookSecret } = resolved;

  const signature = req.headers["stripe-signature"];

  // The tenant's real secret is tried first and is the only candidate in production;
  // STRIPE_DEV_WEBHOOK_SECRET is a second attempt purely for local `stripe listen` testing.
  const candidateSecrets =
    config.env === "production" ? [webhookSecret] : [webhookSecret, config.stripe.devWebhookSecret];

  let event;
  try {
    event = constructEventWithFallback(req.rawBody, signature, candidateSecrets);
  } catch (err) {
    logger.warn(`[payment.controller] Stripe signature verification failed: ${err.message}`);
    return badRequest(res, "Invalid signature");
  }

  // Process synchronously and only ack after it succeeds — a 200 here is a durability promise,
  // since Stripe won't retry one. Returning 500 on failure makes Stripe retry instead.
  // Residual gap: a hard process kill between claim and processing finishing can still strand
  // a claimed-but-unprocessed event with no release. Accepted at current volume.
  try {
    await handleEvent(event, tenant._id);
    return success(res, { received: true });
  } catch (err) {
    logger.error("[payment.controller] webhook processing error", {
      error: err.message,
      stack: err.stack,
    });
    return systemfailure(res, err);
  }
};
