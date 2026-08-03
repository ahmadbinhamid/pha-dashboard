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
    // Same guest-token gate as GET /orders/:id — generic 404 on a bad/missing
    // token so a guessed order_id can't be used to probe order existence,
    // read its total, or start a payment on someone else's order.
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

// refundPayment/refundPaymentManual removed (refund-redesign-spec.md §9) —
// use POST /order/:orderId/refunds (refund.controller.js#createRefund) instead.

// BYOK — each tenant's own Stripe account delivers webhooks to this one
// shared URL with their own opaque `?wt=` token appended (see
// tenantSettings.controller.js#getStripeStatus for where a tenant gets this
// URL to paste into their Stripe Dashboard), resolved here before signature
// verification so the right tenant's own webhook secret gets used — mirrors
// ebay.controller.js's handleWebhook.
exports.handleWebhook = async (req, res) => {
  const { wt } = req.query;
  if (!wt) return badRequest(res, "Missing wt");

  const resolved = await stripeKeysService.findByWebhookToken(wt);
  if (!resolved || !resolved.webhookSecret) return notFound(res, "Webhook not configured");
  const { tenant, webhookSecret } = resolved;

  const signature = req.headers["stripe-signature"];

  // The tenant's real secret is always tried first and is the only candidate
  // in production — STRIPE_DEV_WEBHOOK_SECRET is a second attempt purely for
  // local `stripe listen` testing, which mints its own signing secret that
  // can never match a tenant's real one. See stripe.webhook.service.js.
  const candidateSecrets =
    config.env === "production" ? [webhookSecret] : [webhookSecret, config.stripe.devWebhookSecret];

  let event;
  try {
    event = constructEventWithFallback(req.rawBody, signature, candidateSecrets);
  } catch (err) {
    logger.warn(`[payment.controller] Stripe signature verification failed: ${err.message}`);
    return badRequest(res, "Invalid signature");
  }

  // Process synchronously and only ack after it actually succeeds — the
  // eBay push inside order-stock-sync is already queued/fire-and-forget, so
  // this is just fast DB writes plus one Stripe retrieve. A 200 here is a
  // durability promise: Stripe won't retry a 200, so if we ack before
  // processing finishes and then crash, the event is lost forever even
  // though the idempotency ledger says it was handled. Returning 500 on
  // failure makes Stripe retry instead.
  //
  // Residual gap: release-on-error (see handleEvent's catch) only fires for
  // errors actually thrown during processing. A hard process kill (OOM kill,
  // deploy restart, host crash) between the claim succeeding and processing
  // finishing can still strand a claimed-but-unprocessed event with no
  // release and no thrown error to trigger one. That window is only the
  // handful of DB writes' worth of wall-clock time (low hundreds of ms) —
  // accepted as-is at current volume rather than adding a claim-expiry sweep.
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
