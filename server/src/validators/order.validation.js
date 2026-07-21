// validators/order.validation.js

const Joi = require("joi");
const { ORDER_STATUS, ORDER_CHANNEL } = require("../constants/order.constants");

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
    shipping_address: addressSchema.required(),
    billing_address: addressSchema.allow(null).default(null),
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

module.exports = { createOrder, byIdParam, listOrders, adminByIdParam };
