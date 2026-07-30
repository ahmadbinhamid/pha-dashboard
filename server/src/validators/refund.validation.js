// validators/refund.validation.js
//
// refund-redesign-spec.md §2. Guardrail #1: the client NEVER sends money
// amounts for item or full-invoice refunds — it sends order_item_id +
// quantity + restock flags, and the server derives every cent. `amount` is
// only accepted for scope: "amount", and forbidden otherwise (enforced
// below via Joi's own conditional `.when()`, not by the service layer
// silently ignoring an amount the client wasn't supposed to send).

const Joi = require("joi");
const { REFUND_REASON } = require("../constants/refund.constants");

const byIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

const getRefundable = byIdParam;
const listRefunds = byIdParam;

const refundLine = Joi.object({
  order_item_id: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).required(),
  restock: Joi.boolean().default(false),
});

const paymentAllocation = Joi.object({
  payment_id: Joi.string().hex().length(24).required(),
  amount: Joi.number().integer().min(1).required(), // cents
});

const createRefund = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }), // order id
  body: Joi.object({
    idempotency_key: Joi.string().trim().min(1).required(),
    scope: Joi.string().valid("full_order", "line_items", "amount").required(),

    // Guardrail #1 — forbidden everywhere except scope: "amount".
    amount: Joi.number().integer().min(1).when("scope", {
      is: "amount",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),

    // Required (min 1) for line_items, forbidden for amount, optional/unused
    // for full_order (that scope derives its own lines server-side from
    // every remaining refundable quantity — see §2.2).
    lines: Joi.array()
      .items(refundLine)
      .unique("order_item_id")
      .when("scope", {
        is: "line_items",
        then: Joi.array().min(1).required(),
        otherwise: Joi.forbidden(),
      }),

    // Only meaningful for scope: full_order (§3.4) — ignored otherwise, per
    // the spec's own wording, so no `.when()` restriction here beyond type.
    refund_shipping: Joi.boolean().default(false),
    restock_all: Joi.boolean().default(false),

    adjustment_amount: Joi.number().integer().default(0), // signed cents
    reason: Joi.string()
      .valid(...Object.values(REFUND_REASON))
      .required(),
    internal_note: Joi.string().trim().allow("", null).default(null),

    // Optional — server auto-allocates across the order's payments if
    // omitted (§2.2).
    payment_allocations: Joi.array().items(paymentAllocation).min(1),
  }),
};

const voidRefund = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }), // refund id
  body: Joi.object({
    reason: Joi.string().trim().min(1).required(),
    // Corrections round — required to void a refund with a settled Stripe
    // allocation, since that money already left and voiding here only
    // updates our books, not Stripe (refund.service.js#voidRefund). Left
    // false by default so voiding an all-manual refund needs nothing extra.
    force: Joi.boolean().default(false),
  }),
};

const retryRestock = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }), // refund id
};

module.exports = { getRefundable, listRefunds, createRefund, voidRefund, retryRestock };
