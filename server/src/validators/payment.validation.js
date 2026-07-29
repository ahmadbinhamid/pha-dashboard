// validators/payment.validation.js

const Joi = require("joi");

const createIntent = {
  body: Joi.object({
    order_id: Joi.string().hex().length(24).required(),
    // Same guest_access_token issued once at order creation — required here
    // for the same reason it's required on GET /orders/:id: without it,
    // order_id is guessable/enumerable and would leak order totals via the
    // intent amount, let a stranger spam PaymentIntents against our Stripe
    // account, and let a stranger initiate payment on someone else's order.
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

// createRefund/createManualRefund removed (refund-redesign-spec.md §9) —
// refunds are issued via POST /order/:orderId/refunds now (validators/refund.validation.js).

module.exports = { createIntent, byIdParam, listPayments };
