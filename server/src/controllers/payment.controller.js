// controllers/payment.controller.js

const orderService = require("../services/order.service");
const paymentService = require("../services/payment.service");
const { createPaymentIntentForOrder } = require("../services/stripe/stripe.payment.service");
const { createRefund } = require("../services/stripe/stripe.refund.service");
const { constructEvent, handleEvent } = require("../services/stripe/stripe.webhook.service");
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
    const order = await orderService.getOrderForGuest(req.body.order_id, req.body.token);

    const { payment, client_secret } = await createPaymentIntentForOrder(order);
    return created(res, { payment_id: payment._id, client_secret });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.listPayments = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const result = await paymentService.listPayments({ page, limit, skip, status: req.query.status });
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getPayment = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentWithRefunds(req.params.id);
    if (!payment) return notFound(res, "Payment not found");
    return success(res, payment);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const refund = await createRefund({
      paymentId: req.params.id,
      amount: req.body.amount,
      reason: req.body.reason,
      restock: req.body.restock,
      initiatedBy: req.user._id,
    });
    return created(res, refund);
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.handleWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = constructEvent(req.rawBody, signature);
  } catch (err) {
    logger.warn(`[payment.controller] Stripe signature verification failed: ${err.message}`);
    return badRequest(res, "Invalid signature");
  }

  // Respond immediately — Stripe retries on non-2xx, and processing (which
  // may call out to eBay) shouldn't hold the webhook response open.
  success(res, { received: true });

  handleEvent(event).catch((err) => {
    logger.error("[payment.controller] webhook processing error", {
      error: err.message,
      stack: err.stack,
    });
  });
};
