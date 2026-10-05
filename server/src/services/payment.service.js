// services/payment.service.js

const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const { PAYMENT_STATUS } = require("../constants/payment.constants");

// Collected so far: succeeded payments, each net of its own refunds.
async function getTotalPaidForOrder(orderId) {
  const payments = await Payment.find({ order: orderId, status: PAYMENT_STATUS.SUCCEEDED })
    .select("amount amount_refunded")
    .lean();
  return payments.reduce((sum, p) => sum + Math.max(0, p.amount - (p.amount_refunded || 0)), 0);
}

// What a new intent bills; pending or cancelled attempts don't count as paid.
async function getAmountDueForOrder(order) {
  return Math.max(0, order.total - (await getTotalPaidForOrder(order._id)));
}

// Refunded so far, any status; tells "still owed" from "refunded".
async function getTotalRefundedForOrder(orderId) {
  const payments = await Payment.find({ order: orderId });
  return payments.reduce((sum, p) => sum + (p.amount_refunded || 0), 0);
}

// Full payment history for an order, newest first.
async function getPaymentsForOrder(orderId) {
  return Payment.find({ order: orderId }).sort({ created_at: -1 });
}

async function listPayments({ page = 1, limit = 20, skip = 0, status } = {}, tenantId) {
  const filter = { tenant_id: tenantId };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "order",
        "order_number order_number_prefix invoice_number invoice_number_prefix customer total status"
      ),
    Payment.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

async function getPaymentWithRefunds(paymentId, tenantId) {
  const payment = await Payment.findOne({ _id: paymentId, tenant_id: tenantId }).populate("order");
  if (!payment) return null;

  const refunds = await Refund.find({ payment: payment._id }).sort({ created_at: -1 });
  return { ...payment.toObject(), refunds };
}

module.exports = {
  listPayments,
  getPaymentWithRefunds,
  getTotalPaidForOrder,
  getAmountDueForOrder,
  getTotalRefundedForOrder,
  getPaymentsForOrder,
};
