// services/customer.service.js

const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { UNPAID_ORDER_STATUSES } = require("../constants/order.constants");
const { buildWordSearchOr } = require("../utils/regex");

// Computed on demand, not denormalized, so counts track the Order collection.
async function getOrderStatsByCustomer(customerIds) {
  if (!customerIds.length) return new Map();

  const stats = await Order.aggregate([
    { $match: { customer_id: { $in: customerIds } } },
    {
      $group: {
        _id: "$customer_id",
        orders_count: { $sum: 1 },
        outstanding_invoices_count: {
          $sum: {
            $cond: [
              { $in: ["$status", UNPAID_ORDER_STATUSES] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return new Map(stats.map((s) => [s._id.toString(), s]));
}

/** Headline counts for the customers page; unpaid matches the list's rule. */
async function getCustomerStats(tenantId) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [[totals], [unpaid]] = await Promise.all([
    Customer.aggregate([
      { $match: { tenant_id: tenantId, deleted_at: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          online: { $sum: { $cond: ["$has_online_account", 1, 0] } },
          newThisMonth: { $sum: { $cond: [{ $gte: ["$created_at", monthStart] }, 1, 0] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { tenant_id: tenantId, customer_id: { $ne: null }, status: { $in: UNPAID_ORDER_STATUSES } } },
      { $group: { _id: "$customer_id" } },
      { $count: "customers" },
    ]),
  ]);
  return {
    totalCustomers: totals?.total ?? 0,
    onlineAccounts: totals?.online ?? 0,
    newThisMonth: totals?.newThisMonth ?? 0,
    withUnpaidInvoices: unpaid?.customers ?? 0,
  };
}

async function listCustomers({ skip = 0, limit = 20, search = "" } = {}, tenantId) {
  const filter = { tenant_id: tenantId };
  if (search) {
    filter.$or = buildWordSearchOr(["name", "email", "phone"], search);
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

async function getCustomerById(id, tenantId) {
  const customer = await Customer.findOne({ _id: id, tenant_id: tenantId });
  if (!customer) return null;

  const [orders, statsMap] = await Promise.all([
    Order.find({ customer_id: customer._id, tenant_id: tenantId })
      .sort({ created_at: -1 })
      .populate("payment", "status amount amount_refunded card_brand card_last4 paid_at"),
    getOrderStatsByCustomer([customer._id]),
  ]);

  const stats = statsMap.get(customer._id.toString());
  // Outstanding invoices = unpaid or part-paid orders; no Invoice model exists.
  const outstandingInvoices = orders.filter((order) => UNPAID_ORDER_STATUSES.includes(order.status));

  return {
    ...customer.toObject(),
    orders_count: stats?.orders_count || 0,
    orders,
    outstanding_invoices: outstandingInvoices,
  };
}

async function createCustomer(
  { name, company_name, email, phone, has_online_account, shipping_address, billing_address },
  tenantId,
) {
  return Customer.create({
    tenant_id: tenantId,
    name,
    company_name: company_name || null,
    email: email || null,
    phone: phone || null,
    has_online_account: !!has_online_account,
    shipping_address: shipping_address || null,
    billing_address: billing_address || null,
  });
}

async function updateCustomer(
  id,
  { name, company_name, email, phone, has_online_account, shipping_address, billing_address },
  tenantId,
) {
  const customer = await Customer.findOne({ _id: id, tenant_id: tenantId });
  if (!customer) return null;

  if (name !== undefined) customer.name = name;
  if (company_name !== undefined) customer.company_name = company_name || null;
  if (email !== undefined) customer.email = email || null;
  if (phone !== undefined) customer.phone = phone || null;
  if (has_online_account !== undefined) customer.has_online_account = has_online_account;
  if (shipping_address !== undefined) customer.shipping_address = shipping_address || null;
  if (billing_address !== undefined) customer.billing_address = billing_address || null;

  await customer.save();
  return customer;
}

async function deleteCustomer(id, tenantId) {
  const customer = await Customer.findOne({ _id: id, tenant_id: tenantId });
  if (!customer) return null;
  await customer.softDelete();
  return customer;
}

module.exports = {
  getCustomerStats,
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
