// validators/order.validation.js

const Joi = require("joi");
const {
  ORDER_STATUS,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_FULFILLMENT_STATUS,
  ORDER_PAYMENT_STATUS,
  CUSTOM_ORDER_ITEM_NAME_MAX,
} = require("../constants/order.constants");
const { ORDER_PAYMENT_CHOICE, PAYMENT_METHOD } = require("../constants/payment.constants");
const { ADDRESS_TYPE } = require("../constants/shipping.constants");

const addressSchema = Joi.object({
  address: Joi.string().trim().min(1).required(),
  suburb: Joi.string().trim().min(1).required(),
  state: Joi.string().trim().min(1).required(),
  postcode: Joi.string().trim().min(1).required(),
  // Residential or business; prices calculated shipping at checkout.
  address_type: Joi.string().valid(...Object.values(ADDRESS_TYPE)).allow(null),
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
    // Pickup has no address; forbid both rather than ignore stale form data.
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

// ── Admin ──

const listOrders = {
  query: Joi.object({
    search: Joi.string().trim().allow(""),
    status: Joi.string()
      .valid(...Object.values(ORDER_STATUS))
      .allow(""),
    channel: Joi.string()
      .valid(...Object.values(ORDER_CHANNEL))
      .allow(""),
    delivery_method: Joi.string()
      .valid(...Object.values(ORDER_DELIVERY_METHOD))
      .allow(""),
    fulfillment_status: Joi.string()
      .valid(...Object.values(ORDER_FULFILLMENT_STATUS))
      .allow(""),
    payment_status: Joi.string()
      .valid(...Object.values(ORDER_PAYMENT_STATUS))
      .allow(""),
  }),
};

const adminByIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

// Customer-facing note for this specific line.
const lineNoteSchema = Joi.string().trim().allow("", null).default(null);

const catalogueLineSchema = Joi.object({
  product: Joi.string().hex().length(24).required(),
  variant: Joi.string().hex().length(24).allow(null).default(null),
  quantity: Joi.number().integer().min(1).required(),
  discount_amount: Joi.number().min(0).default(0),
  note: lineNoteSchema,
});

// Order-only line typed in at POS; prices are dollars, shipping is per unit.
const customLineSchema = Joi.object({
  is_custom: Joi.valid(true).required(),
  name: Joi.string().trim().min(1).max(CUSTOM_ORDER_ITEM_NAME_MAX).required(),
  unit_price: Joi.number().greater(0).required(),
  shipping_cost: Joi.number().min(0).default(0),
  quantity: Joi.number().integer().min(1).default(1),
  discount_amount: Joi.number().min(0).default(0),
  note: lineNoteSchema,
});

const isCustomLine = Joi.object({ is_custom: Joi.valid(true).required() }).unknown();

// Counter sale for a known customer: line discounts and an amount paid.
const createManualOrder = {
  body: Joi.object({
    customer_id: Joi.string().hex().length(24).required(),
    items: Joi.array()
      .items(
        Joi.alternatives().conditional(isCustomLine, {
          then: customLineSchema,
          otherwise: catalogueLineSchema,
        }),
      )
      .min(1)
      .required(),
    delivery_method: Joi.string()
      .valid(...Object.values(ORDER_DELIVERY_METHOD))
      .default(ORDER_DELIVERY_METHOD.PICKUP),
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
    // Customer-facing note for the whole order.
    note: Joi.string().trim().allow("", null).default(null),
    // payment_link collects nothing now; cash/transfer may record an amount.
    payment_method: Joi.string()
      .valid(...Object.values(ORDER_PAYMENT_CHOICE))
      .required(),
    // Dollars collected now; omitted or 0 leaves the whole invoice owing.
    amount_paid: Joi.number().min(0).default(0),
    // Dollars; overrides the per-item shipping sum. Ignored for pickup.
    shipping_cost: Joi.number().min(0),
  }),
};

// Tracking fields depend on delivery_method, so the service checks them.
const sendOrderEmail = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    tracking_number: Joi.string().trim().min(1),
    carrier_name: Joi.string().trim().min(1),
  }),
};

const generatePaymentLink = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

const sendPaymentLinkEmail = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

// Fulfilment only; payment_status is always derived from payments.
const updateOrderStatus = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    status: Joi.string()
      .valid(...Object.values(ORDER_FULFILLMENT_STATUS))
      .required(),
  }),
};

// Follow-up cash/transfer payment; the service checks the balance.
const recordPayment = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    payment_method: Joi.string()
      .valid(...Object.values(PAYMENT_METHOD))
      .required(),
    amount: Joi.number().greater(0).required(), // dollars
  }),
};

// Line price fix on eBay/manual orders; the service rejects storefront.
const updateOrderItemPrice = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
    itemIndex: Joi.number().integer().min(0).required(),
  }),
  body: Joi.object({
    unit_price: Joi.number().greater(0).required(), // dollars
  }),
};

// Amount limits need the order itself, so the service checks them.
const updateOrderShippingCost = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    shipping_cost: Joi.number().min(0).required(), // dollars
  }),
};

// Line discount fix; the service checks it against the line subtotal.
const updateOrderItemDiscount = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
    itemIndex: Joi.number().integer().min(0).required(),
  }),
  body: Joi.object({
    discount_amount: Joi.number().min(0).required(), // dollars
  }),
};

// Optional — blank/null clears it.
const updateOrderReferenceNumber = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    reference_number: Joi.string().trim().allow("", null),
  }),
};

const addOrderNote = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    text: Joi.string().trim().min(1).required().messages({
      "string.empty": "Note text is required",
      "any.required": "Note text is required",
    }),
  }),
};

// Edits the order's own customer snapshot, not the linked Customer.
const updateOrderCustomerDetails = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    customer: Joi.object({
      name: Joi.string().trim().min(1),
      email: Joi.string().trim().email().allow("", null),
      phone: Joi.string().trim().allow("", null),
    }),
    // Pickup has no address; the service knows the method, so just omit.
    shipping_address: addressSchema,
    billing_address: addressSchema.allow(null),
  }),
};

module.exports = {
  createOrder,
  byIdParam,
  listOrders,
  adminByIdParam,
  sendOrderEmail,
  createManualOrder,
  generatePaymentLink,
  sendPaymentLinkEmail,
  updateOrderStatus,
  recordPayment,
  addOrderNote,
  updateOrderCustomerDetails,
  updateOrderReferenceNumber,
  updateOrderItemPrice,
  updateOrderShippingCost,
  updateOrderItemDiscount,
};
