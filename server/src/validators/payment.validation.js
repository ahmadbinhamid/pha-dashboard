// validators/payment.validation.js

const Joi = require("joi");

const createIntent = {
  body: Joi.object({
    order_id: Joi.string().hex().length(24).required(),
    // Same guest_access_token as GET /orders/:id; without it, order_id is guessable and would
    // leak totals, let a stranger spam PaymentIntents, or pay on someone else's order.
    token: Joi.string().required(),
  }),
};

const byIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

const listPayments = {
  query: Joi.object({
    status: Joi.string().allow(""),
  }),
};

// createRefund/createManualRefund removed — refunds are issued via POST /order/:orderId/refunds now.

module.exports = { createIntent, byIdParam, listPayments };
