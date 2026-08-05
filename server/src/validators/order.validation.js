// validators/order.validation.js

const Joi = require("joi");
const { ORDER_STATUS, ORDER_CHANNEL, ORDER_DELIVERY_METHOD } = require("../constants/order.constants");
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
    delivery_method: Joi.string()
      .valid(...Object.values(ORDER_DELIVERY_METHOD))
      .allow(""),
  }),
};

const adminByIdParam = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

// In-person/counter sale created by staff from the admin dashboard — always
// tied to a known Customer record, and (unlike guest checkout) accepts a
// per-line discount and an optional amount actually collected at the register.
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
    // How this order is being settled — required, always one of the three
    // choices. "payment_link" means nothing is collected now (amount_paid is
    // ignored server-side regardless of what's sent); cash/online_transfer
    // may optionally record an amount actually collected at the register.
    payment_method: Joi.string()
      .valid(...Object.values(ORDER_PAYMENT_CHOICE))
      .required(),
    // Dollars — what the staff member actually collected right now. Omitted
    // or 0 means the full invoice is left outstanding.
    amount_paid: Joi.number().min(0).default(0),
  }),
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

const generatePaymentLink = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

const sendPaymentLinkEmail = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

// Restricted to the 5 statuses safely reachable by a manual admin action —
// refunded/partially_refunded are deliberately excluded, those only change
// via the dedicated refund flow (see order.service.js#updateOrderStatus).
const updateOrderStatus = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    status: Joi.string()
      .valid(
        ORDER_STATUS.PENDING_PAYMENT,
        ORDER_STATUS.PARTIALLY_PAID,
        ORDER_STATUS.PAID,
        ORDER_STATUS.FULFILLED,
        ORDER_STATUS.CANCELLED,
      )
      .required(),
  }),
};

// Records a follow-up cash/online-transfer payment against an order's
// outstanding balance — see order.service.js#recordOrderPayment for the
// remaining-balance check (can't be done here, it depends on DB state).
const recordPayment = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    payment_method: Joi.string()
      .valid(...Object.values(PAYMENT_METHOD))
      .required(),
    amount: Joi.number().greater(0).required(), // dollars
  }),
};

// Corrects a single line item's price on an eBay/manual order — see
// order.service.js#updateOrderItemPrice for why storefront orders are
// excluded (that check needs DB state, so it lives in the service, not here).
const updateOrderItemPrice = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
    itemIndex: Joi.number().integer().min(0).required(),
  }),
  body: Joi.object({
    unit_price: Joi.number().greater(0).required(), // dollars
  }),
};

// See order.service.js#updateOrderShippingCost — negative-amount and
// exceeds-total checks need DB state, so they live in the service, not here.
const updateOrderShippingCost = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    shipping_cost: Joi.number().min(0).required(), // dollars
  }),
};

// Corrects a single line item's discount on an eBay/manual order — see
// order.service.js#updateOrderItemDiscount for the exceeds-line-subtotal
// check, which needs DB state so it lives in the service, not here.
const updateOrderItemDiscount = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
    itemIndex: Joi.number().integer().min(0).required(),
  }),
  body: Joi.object({
    discount_amount: Joi.number().min(0).required(), // dollars
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

// Edits the order's OWN customer/address snapshot — not the linked Customer
// record (if any). See order.service.js#updateOrderCustomerDetails.
const updateOrderCustomerDetails = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    customer: Joi.object({
      name: Joi.string().trim().min(1),
      email: Joi.string().trim().email().allow("", null),
      phone: Joi.string().trim().allow("", null),
    }),
    // Pickup orders carry no address at all — omit both fields rather than
    // sending null/forbidden, since whether they're editable depends on the
    // order's own delivery_method, which the service layer already knows.
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
  updateOrderItemPrice,
  updateOrderShippingCost,
  updateOrderItemDiscount,
};
