// validators/order.validation.js

const Joi = require("joi");
const {
  ORDER_STATUS,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_FULFILLMENT_STATUS,
  ORDER_PAYMENT_STATUS,
} = require("../constants/order.constants");
const { ORDER_PAYMENT_CHOICE, PAYMENT_METHOD } = require("../constants/payment.constants");

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
    // Pickup has nowhere to ship/bill to — forbid both rather than silently ignore stale form state.
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

// In-person/counter sale; always tied to a known Customer record, and unlike guest checkout
// accepts a per-line discount and an optional amount collected at the register.
const createManualOrder = {
  body: Joi.object({
    customer_id: Joi.string().hex().length(24).required(),
    items: Joi.array()
      .items(
        Joi.object({
          product: Joi.string().hex().length(24).required(),
          variant: Joi.string().hex().length(24).allow(null).default(null),
          quantity: Joi.number().integer().min(1).required(),
          discount_amount: Joi.number().min(0).default(0),
          // Customer-facing note for this specific line.
          note: Joi.string().trim().allow("", null).default(null),
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
    // How this order is being settled. "payment_link" means nothing is collected now
    // (amount_paid ignored server-side); cash/online_transfer may record an amount collected.
    payment_method: Joi.string()
      .valid(...Object.values(ORDER_PAYMENT_CHOICE))
      .required(),
    // Dollars collected right now; omitted or 0 leaves the full invoice outstanding.
    amount_paid: Joi.number().min(0).default(0),
    // Dollars, overrides the computed per-item shipping sum; ignored entirely for pickup orders.
    shipping_cost: Joi.number().min(0),
  }),
};

// tracking_number/carrier_name are only meaningful for DELIVERY orders; whether they're
// required depends on delivery_method (not in this body), so that check lives in the service.
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

// Pure fulfillment lifecycle — payment_status is never settable here, always derived from payments.
const updateOrderStatus = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    status: Joi.string()
      .valid(...Object.values(ORDER_FULFILLMENT_STATUS))
      .required(),
  }),
};

// Records a follow-up cash/online-transfer payment; the remaining-balance check needs DB
// state, so it lives in the service, not here.
const recordPayment = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    payment_method: Joi.string()
      .valid(...Object.values(PAYMENT_METHOD))
      .required(),
    amount: Joi.number().greater(0).required(), // dollars
  }),
};

// Corrects a single line item's price on an eBay/manual order; storefront exclusion needs DB
// state, so that check lives in the service, not here.
const updateOrderItemPrice = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
    itemIndex: Joi.number().integer().min(0).required(),
  }),
  body: Joi.object({
    unit_price: Joi.number().greater(0).required(), // dollars
  }),
};

// Negative-amount and exceeds-total checks need DB state, so they live in the service, not here.
const updateOrderShippingCost = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    shipping_cost: Joi.number().min(0).required(), // dollars
  }),
};

// Corrects a single line item's discount; the exceeds-line-subtotal check needs DB state,
// so it lives in the service, not here.
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

// Edits the order's own customer/address snapshot, not the linked Customer record.
const updateOrderCustomerDetails = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    customer: Joi.object({
      name: Joi.string().trim().min(1),
      email: Joi.string().trim().email().allow("", null),
      phone: Joi.string().trim().allow("", null),
    }),
    // Pickup orders carry no address — omit both fields rather than null/forbidden, since
    // editability depends on delivery_method, which the service already knows.
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
