// services/payment.service.js

const Payment = require("../models/Payment");
const Refund = require("../models/Refund");

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

module.exports = { listPayments, getPaymentWithRefunds };
