// services/customer.service.js

const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { ORDER_STATUS } = require("../constants/order.constants");

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Orders aren't a relation stored on Customer itself — pulled on demand so a
// customer's order count/outstanding-invoice count always reflects the
// current Order collection rather than a denormalized field that can drift.
async function getOrderStatsByCustomer(customerIds) {
  if (!customerIds.length) return new Map();

  const stats = await Order.aggregate([
    { $match: { customer_id: { $in: customerIds } } },
    {
      $group: {
        _id: "$customer_id",
        orders_count: { $sum: 1 },
        outstanding_invoices_count: {
          $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.PENDING_PAYMENT] }, 1, 0] },
        },
      },
    },
  ]);

  return new Map(stats.map((s) => [s._id.toString(), s]));
}

async function listCustomers({ skip = 0, limit = 20, search = "" } = {}) {
  const filter = {};
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }

  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  const statsMap = await getOrderStatsByCustomer(items.map((c) => c._id));
  const withStats = items.map((c) => {
    const stats = statsMap.get(c._id.toString());
    return {
      ...c.toObject(),
      orders_count: stats?.orders_count || 0,
      outstanding_invoices_count: stats?.outstanding_invoices_count || 0,
    };
  });

  return { items: withStats, total };
}

async function getCustomerById(id) {
  const customer = await Customer.findById(id);
  if (!customer) return null;

  const [orders, statsMap] = await Promise.all([
    Order.find({ customer_id: customer._id })
      .sort({ created_at: -1 })
      .populate("payment", "status amount amount_refunded card_brand card_last4 paid_at"),
    getOrderStatsByCustomer([customer._id]),
  ]);

  const stats = statsMap.get(customer._id.toString());
  // Outstanding invoices = this customer's orders still awaiting payment —
  // there's no separate Invoice entity, an unpaid order IS the invoice.
  const outstandingInvoices = orders.filter((order) => order.status === ORDER_STATUS.PENDING_PAYMENT);

  return {
    ...customer.toObject(),
    orders_count: stats?.orders_count || 0,
    orders,
    outstanding_invoices: outstandingInvoices,
  };
}

async function createCustomer({ name, email, phone, has_online_account }) {
  return Customer.create({
    name,
    email: email || null,
    phone: phone || null,
    has_online_account: !!has_online_account,
  });
}

async function updateCustomer(id, { name, email, phone, has_online_account }) {
  const customer = await Customer.findById(id);
  if (!customer) return null;

  if (name !== undefined) customer.name = name;
  if (email !== undefined) customer.email = email || null;
  if (phone !== undefined) customer.phone = phone || null;
  if (has_online_account !== undefined) customer.has_online_account = has_online_account;

  await customer.save();
  return customer;
}

async function deleteCustomer(id) {
  const customer = await Customer.findById(id);
  if (!customer) return null;
  await customer.softDelete();
  return customer;
}

module.exports = { listCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };
