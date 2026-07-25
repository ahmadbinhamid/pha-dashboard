// services/payment.service.js

const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const { PAYMENT_STATUS } = require("../constants/payment.constants");

// Sums every succeeded Payment on an order, net of its own refunds — the
// single source of truth for "how much has actually been collected",
// whether that came from one payment or several (deposit + top-up,
// deposit + payment-link remainder, etc). A pending/failed/canceled Payment
// never counts, and a refund only ever reduces its own payment's
// contribution, never another payment's.
async function getTotalPaidForOrder(orderId) {
  const payments = await Payment.find({ order: orderId, status: PAYMENT_STATUS.SUCCEEDED });
  return payments.reduce((sum, p) => sum + Math.max(0, p.amount - p.amount_refunded), 0);
}

// Full payment history for an order, newest first — used by the admin order
// detail view instead of the old single `order.payment` populate, which only
// ever reflected the most recently created Payment.
async function getPaymentsForOrder(orderId) {
  return Payment.find({ order: orderId }).sort({ created_at: -1 });
}

async function listPayments({ page = 1, limit = 20, skip = 0, status } = {}) {
  const filter = {};
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "order_number customer total status"),
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

async function getPaymentWithRefunds(paymentId) {
  const payment = await Payment.findById(paymentId).populate("order");
  if (!payment) return null;

  const refunds = await Refund.find({ payment: payment._id }).sort({ created_at: -1 });
  return { ...payment.toObject(), refunds };
}

module.exports = { listPayments, getPaymentWithRefunds, getTotalPaidForOrder, getPaymentsForOrder };
