// controllers/order.controller.js

const orderService = require("../services/order.service");
const orderEditService = require("../services/order-edit.service");
const { fullName } = require("../utils/user");
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
    return success(res, await orderService.getGuestOrderView(req.params.id, req.query.token, req.tenantId));
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

// ── Admin ──

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

exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats(req.tenantId);
    return success(res, stats);
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
    const order = await orderEditService.getEditableOrderDetail(req.params.id, req.tenantId);
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
    const order = await orderService.getOrderForPaymentLink(req.params.id, req.tenantId);
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

// Who made an edit, for the audit note.
const editor = (req) => ({ id: req.user?._id ?? null, name: fullName(req.user ?? {}) || "staff" });

// Runs an edit, then answers with the refreshed detail (server totals).
async function respondWithEdit(req, res, message, edit) {
  try {
    await edit(editor(req));
    return success(res, await orderEditService.getEditableOrderDetail(req.params.id, req.tenantId), message);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    // jsonerr.code says which 409 it was, so the client can explain it.
    if (err.status) return requestfailure(res, err, err.code ? { code: err.code } : null);
    return systemfailure(res, err);
  }
}

exports.updateOrderItemPrice = (req, res) =>
  respondWithEdit(req, res, "Price updated", (user) =>
    orderEditService.updateOrderItemPrice(req.params.id, req.params.itemIndex, req.body, user, req.tenantId),
  );

exports.updateOrderShippingCost = (req, res) =>
  respondWithEdit(req, res, "Shipping cost updated", (user) =>
    orderEditService.updateOrderShippingCost(req.params.id, req.body, user, req.tenantId),
  );

exports.updateOrderItemDiscount = (req, res) =>
  respondWithEdit(req, res, "Discount updated", (user) =>
    orderEditService.updateOrderItemDiscount(req.params.id, req.params.itemIndex, req.body, user, req.tenantId),
  );

exports.addOrderItem = (req, res) =>
  respondWithEdit(req, res, "Item added", (user) =>
    orderEditService.addOrderItem(req.params.id, req.body, user, req.tenantId),
  );

exports.updateOrderItemQuantity = (req, res) =>
  respondWithEdit(req, res, "Quantity updated", (user) =>
    orderEditService.updateOrderItemQuantity(req.params.id, req.params.itemId, req.body, user, req.tenantId),
  );

exports.removeOrderItem = (req, res) =>
  respondWithEdit(req, res, "Item removed", (user) =>
    orderEditService.removeOrderItem(req.params.id, req.params.itemId, req.query, user, req.tenantId),
  );


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
