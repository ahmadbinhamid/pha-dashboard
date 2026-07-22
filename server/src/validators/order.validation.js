// validators/order.validation.js

const Joi = require("joi");
const { ORDER_STATUS, ORDER_CHANNEL, ORDER_DELIVERY_METHOD } = require("../constants/order.constants");

const addressSchema = Joi.object({
  address: Joi.string().trim().min(1).required(),
  suburb: Joi.string().trim().min(1).required(),
  state: Joi.string().trim().min(1).required(),
  postcode: Joi.string().trim().min(1).required(),
});

const createOrder = {
  body: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          product: Joi.string().hex().length(24).required(),
          variant: Joi.string().hex().length(24).allow(null).default(null),
          quantity: Joi.number().integer().min(1).required(),
        }),
      )
      .min(1)
      .required(),
    customer: Joi.object({
      name: Joi.string().trim().min(1).required(),
      email: Joi.string().trim().email().required(),
      phone: Joi.string().trim().min(1).required(),
    }).required(),
    delivery_method: Joi.string()
      .valid(...Object.values(ORDER_DELIVERY_METHOD))
      .default(ORDER_DELIVERY_METHOD.DELIVERY),
    // Pickup has nowhere to ship/bill to — forbid both instead of silently
    // ignoring them if the client sends stale form state.
    shipping_address: Joi.when("delivery_method", {
      is: ORDER_DELIVERY_METHOD.PICKUP,
      then: Joi.forbidden(),
      otherwise: addressSchema.required(),
    }),
    billing_address: Joi.when("delivery_method", {
      is: ORDER_DELIVERY_METHOD.PICKUP,
      then: Joi.forbidden(),
      otherwise: addressSchema.allow(null).default(null),
    }),
  }),
};

const byIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  query: Joi.object({ token: Joi.string().required() }),
};

// ── Admin ──────────────────────────────────────────────────────────────────

const listOrders = {
  query: Joi.object({
    search: Joi.string().trim().allow(""),
    status: Joi.string()
      .valid(...Object.values(ORDER_STATUS))
      .allow(""),
    channel: Joi.string()
      .valid(...Object.values(ORDER_CHANNEL))
      .allow(""),
  }),
};

const adminByIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

// tracking_number/carrier_name are only meaningful for DELIVERY orders —
// whether they're actually required depends on the order's own
// delivery_method, which isn't part of this request body, so that check
// happens in order.service.js#sendOrderNotification instead of here.
const sendOrderEmail = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    tracking_number: Joi.string().trim().min(1),
    carrier_name: Joi.string().trim().min(1),
  }),
};

module.exports = { createOrder, byIdParam, listOrders, adminByIdParam, sendOrderEmail };
