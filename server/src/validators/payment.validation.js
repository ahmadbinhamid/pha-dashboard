// validators/payment.validation.js

const Joi = require("joi");
const { REFUND_REASON } = require("../constants/refund.constants");

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

const createRefund = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }), // payment id
  body: Joi.object({
    amount: Joi.number().integer().min(1).required(),
    reason: Joi.string()
      .valid(...Object.values(REFUND_REASON).filter((r) => r !== REFUND_REASON.OTHER))
      .required(),
    restock: Joi.boolean().default(false),
  }),
};

module.exports = { createIntent, byIdParam, listPayments, createRefund };
