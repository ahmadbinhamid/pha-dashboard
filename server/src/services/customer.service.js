// services/customer.service.js

const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { UNPAID_ORDER_STATUSES } = require("../constants/order.constants");
const { buildWordSearchOr } = require("../utils/regex");
const { CUSTOMER_SOURCE } = require("../constants/customer.constants");
const { findBusinessIdsByName, resolveBusinessId } = require("./business.service");

// Other reps shown on a profile, a business rarely has more.
const REPRESENTATIVES_LIMIT = 50;
const BUSINESS_POPULATE = { path: "business_id", select: "name" };

// Flattens the populated ref to an id plus a { _id, name } for display.
function withBusiness(doc) {
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const business = obj.business_id?.name ? { _id: obj.business_id._id, name: obj.business_id.name } : null;
  return { ...obj, business_id: business?._id ?? obj.business_id ?? null, business };
}

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

/** Headline counts for the customers page, unpaid matches the list's rule. */
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

async function listCustomers({ skip = 0, limit = 20, search = "", includeStorefront = false } = {}, tenantId) {
  const filter = { tenant_id: tenantId };
  if (!includeStorefront) filter.source = { $ne: CUSTOMER_SOURCE.STOREFRONT };
  if (search) {
    // A business name match lists every rep of that business separately.
    const businessIds = await findBusinessIdsByName(tenantId, search);
    filter.$or = buildWordSearchOr(["name", "email", "phone"], search);
    if (businessIds.length) filter.$or.push({ business_id: { $in: businessIds } });
  }

  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate(BUSINESS_POPULATE),
    Customer.countDocuments(filter),
  ]);

  const statsMap = await getOrderStatsByCustomer(items.map((c) => c._id));
  const withStats = items.map((c) => {
    const stats = statsMap.get(c._id.toString());
    return {
      ...withBusiness(c),
      orders_count: stats?.orders_count || 0,
      outstanding_invoices_count: stats?.outstanding_invoices_count || 0,
    };
  });

  return { items: withStats, total };
}

/** Captures a website shopper by email, staff records keep their source. */
async function upsertStorefrontCustomer(tenantId, { name, email, phone, marketing_opt_in = false }) {
  const filter = { tenant_id: tenantId, email: String(email).trim().toLowerCase() };
  const update = {
    $setOnInsert: { name, phone, source: CUSTOMER_SOURCE.STOREFRONT },
    // NOTE: an unticked box never revokes consent, unsubscribing is separate.
    ...(marketing_opt_in && { $set: { marketing_opt_in: true, marketing_opt_in_at: new Date() } }),
  };
  // NOTE: reps sharing a business inbox all match, the oldest takes the order.
  const options = { upsert: true, new: true, sort: { created_at: 1 } };
  try {
    return await Customer.findOneAndUpdate(filter, update, options).lean();
  } catch (err) {
    // Two first orders racing on one email: the loser reads the winner's row.
    if (err?.code !== 11000) throw err;
    const retry = update.$set ? { $set: update.$set } : {};
    return Customer.findOneAndUpdate(filter, retry, { new: true, sort: { created_at: 1 } }).lean();
  }
}

/** Fellow reps of the same business, newest first, excluding `customerId`. */
async function listRepresentatives(tenantId, businessId, customerId) {
  if (!businessId) return [];
  return Customer.find({ tenant_id: tenantId, business_id: businessId, _id: { $ne: customerId } })
    .select("name email phone")
    .sort({ created_at: -1 })
    .limit(REPRESENTATIVES_LIMIT)
    .lean();
}

async function getCustomerById(id, tenantId) {
  const customer = await Customer.findOne({ _id: id, tenant_id: tenantId }).populate(BUSINESS_POPULATE);
  if (!customer) return null;
  const shaped = withBusiness(customer);

  const [orders, statsMap, representatives] = await Promise.all([
    Order.find({ customer_id: customer._id, tenant_id: tenantId })
      .sort({ created_at: -1 })
      .populate("payment", "status amount amount_refunded card_brand card_last4 paid_at"),
    getOrderStatsByCustomer([customer._id]),
    listRepresentatives(tenantId, shaped.business_id, customer._id),
  ]);

  const stats = statsMap.get(customer._id.toString());
  // Outstanding invoices = unpaid or part-paid orders, no Invoice model exists.
  const outstandingInvoices = orders.filter((order) => UNPAID_ORDER_STATUSES.includes(order.status));

  return {
    ...shaped,
    orders_count: stats?.orders_count || 0,
    orders,
    outstanding_invoices: outstandingInvoices,
    representatives,
  };
}

/** Customer plus business name, for snapshotting onto an order. */
async function getCustomerForOrder(id, tenantId) {
  const customer = await Customer.findOne({ _id: id, tenant_id: tenantId }).populate(BUSINESS_POPULATE).lean();
  return customer ? withBusiness(customer) : null;
}

async function createCustomer(
  { name, business_name, email, phone, has_online_account, shipping_address, billing_address },
  tenantId,
) {
  const customer = await Customer.create({
    tenant_id: tenantId,
    name,
    business_id: await resolveBusinessId(tenantId, business_name),
    email: email || null,
    phone: phone || null,
    has_online_account: !!has_online_account,
    shipping_address: shipping_address || null,
    billing_address: billing_address || null,
  });
  return withBusiness(await customer.populate(BUSINESS_POPULATE));
}

async function updateCustomer(
  id,
  { name, business_name, email, phone, has_online_account, shipping_address, billing_address },
  tenantId,
) {
  const customer = await Customer.findOne({ _id: id, tenant_id: tenantId });
  if (!customer) return null;

  if (name !== undefined) customer.name = name;
  if (business_name !== undefined) customer.business_id = await resolveBusinessId(tenantId, business_name);
  if (email !== undefined) customer.email = email || null;
  if (phone !== undefined) customer.phone = phone || null;
  if (has_online_account !== undefined) customer.has_online_account = has_online_account;
  if (shipping_address !== undefined) customer.shipping_address = shipping_address || null;
  if (billing_address !== undefined) customer.billing_address = billing_address || null;

  await customer.save();
  return withBusiness(await customer.populate(BUSINESS_POPULATE));
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
  upsertStorefrontCustomer,
  getCustomerById,
  getCustomerForOrder,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
