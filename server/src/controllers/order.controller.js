// controllers/order.controller.js

const orderService = require("../services/order.service");
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
