// controllers/order.controller.js

const orderService = require("../services/order.service");
const Order = require("../models/Order");
const { createPaymentLinkForOrder } = require("../services/stripe/stripe.payment.service");
const { created, success, notFound, requestfailure, systemfailure } = require("../utils/http/response");

exports.createOrder = async (req, res) => {
  try {
    const order = await orderService.createOrder(req.body);
    return created(res, order);
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await orderService.getOrderForGuest(req.params.id, req.query.token);
    // getOrderForGuest explicitly re-selects guest_access_token to verify it —
    // strip it back out before responding so it isn't echoed on every poll.
    const safeOrder = order.toObject();
    delete safeOrder.guest_access_token;
    return success(res, safeOrder);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

// ── Admin ──────────────────────────────────────────────────────────────────

exports.listOrders = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const result = await orderService.listOrders({
      page,
      limit,
      skip,
      status: req.query.status,
      channel: req.query.channel,
      search: req.query.search,
    });
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createManualOrder = async (req, res) => {
  try {
    const order = await orderService.createManualOrder(req.body);
    return created(res, order);
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await orderService.getOrderDetailForAdmin(req.params.id);
    return success(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.sendOrderEmail = async (req, res) => {
  try {
    const order = await orderService.sendOrderNotification(req.params.id, req.body);
    return success(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.generatePaymentLink = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return notFound(res, "Order not found");
    const { url } = await createPaymentLinkForOrder(order);
    return success(res, { url });
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.addOrderNote = async (req, res) => {
  try {
    const order = await orderService.addOrderNote(req.params.id, {
      text: req.body.text,
      userId: req.user?._id,
    });
    return created(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};
