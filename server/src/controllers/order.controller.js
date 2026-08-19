// controllers/order.controller.js

const orderService = require("../services/order.service");
const Order = require("../models/Order");
const { createPaymentLinkForOrder } = require("../services/stripe/stripe.payment.service");
const { created, success, notFound, requestfailure, systemfailure } = require("../utils/http/response");

exports.createOrder = async (req, res) => {
  try {
    const order = await orderService.createOrder(req.body, req.tenant);
    return created(res, order);
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await orderService.getOrderForGuest(req.params.id, req.query.token, req.tenantId);
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
    const result = await orderService.listOrders(
      {
        page,
        limit,
        skip,
        status: req.query.status,
        channel: req.query.channel,
        delivery_method: req.query.delivery_method,
        fulfillment_status: req.query.fulfillment_status,
        payment_status: req.query.payment_status,
        search: req.query.search,
      },
      req.tenantId,
    );
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createManualOrder = async (req, res) => {
  try {
    const order = await orderService.createManualOrder(req.body, req.tenant);
    return created(res, order);
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await orderService.getOrderDetailForAdmin(req.params.id, req.tenantId);
    return success(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.sendOrderEmail = async (req, res) => {
  try {
    const order = await orderService.sendOrderNotification(req.params.id, req.body, req.tenantId);
    return success(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.downloadInvoicePdf = async (req, res) => {
  try {
    const { pdfBuffer, orderNumber } = await orderService.getInvoicePdfForOrder(req.params.id, req.tenantId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${orderNumber}-invoice.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.generatePaymentLink = async (req, res) => {
  try {
    // +guest_access_token: select:false by default — needed to build the link.
    const order = await Order.findOne({ _id: req.params.id, tenant_id: req.tenantId }).select("+guest_access_token");
    if (!order) return notFound(res, "Order not found");
    const { url } = createPaymentLinkForOrder(order, req.tenant);
    return success(res, { url });
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.sendPaymentLinkEmail = async (req, res) => {
  try {
    const { url } = await orderService.sendPaymentLinkEmail(req.params.id, req.tenant);
    return success(res, { url });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, { status: req.body.status }, req.tenantId);
    return success(res, order, "Order status updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const order = await orderService.recordOrderPayment(req.params.id, req.body, req.tenantId);
    return created(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.updateOrderCustomerDetails = async (req, res) => {
  try {
    const order = await orderService.updateOrderCustomerDetails(req.params.id, req.body, req.tenantId);
    return success(res, order, "Order updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.updateOrderItemPrice = async (req, res) => {
  try {
    const order = await orderService.updateOrderItemPrice(
      req.params.id,
      req.params.itemIndex,
      { unit_price: req.body.unit_price, userId: req.user?._id },
      req.tenantId,
    );
    return success(res, order, "Price updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.updateOrderShippingCost = async (req, res) => {
  try {
    const order = await orderService.updateOrderShippingCost(
      req.params.id,
      { shipping_cost: req.body.shipping_cost },
      req.tenantId,
    );
    return success(res, order, "Shipping cost updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.updateOrderReferenceNumber = async (req, res) => {
  try {
    const order = await orderService.updateOrderReferenceNumber(
      req.params.id,
      { reference_number: req.body.reference_number },
      req.tenantId,
    );
    return success(res, order, "Order number updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.updateOrderItemDiscount = async (req, res) => {
  try {
    const order = await orderService.updateOrderItemDiscount(
      req.params.id,
      req.params.itemIndex,
      { discount_amount: req.body.discount_amount },
      req.tenantId,
    );
    return success(res, order, "Discount updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.addOrderNote = async (req, res) => {
  try {
    const order = await orderService.addOrderNote(
      req.params.id,
      { text: req.body.text, userId: req.user?._id },
      req.tenantId,
    );
    return created(res, order);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};
