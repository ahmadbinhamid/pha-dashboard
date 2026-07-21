// services/order.service.js

const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Counter = require("../models/Counter");
const Refund = require("../models/Refund");
const { getTotalStockForProductVariant, resolveSkuToIds } = require("./inventory.service");
const { ORDER_STATUS, ORDER_CHANNEL } = require("../constants/order.constants");
const { mapEbayOrder } = require("./ebay/ebay.order.mapper");
const { logger } = require("../loaders/logging");

// GST-inclusive AU retail pricing: GST component = price / 11, never added on top.
const GST_DIVISOR = 11;

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function nextOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "order_number" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `PHA-${String(counter.seq).padStart(5, "0")}`;
}

function generateGuestAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Re-derives price/availability from the DB for every line item — the
// storefront's cart totals are never trusted for what gets charged.
async function resolveOrderItem({ product: productId, variant: variantId, quantity }) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError("Invalid quantity", 400);
  }

  const product = await Product.findById(productId);
  if (!product || !product.is_published_online) {
    throw httpError("Product not available", 400);
  }

  let variant = null;
  let unitPriceDollars = product.price;
  let sku = product.sku;
  let name = product.title;

  if (variantId) {
    variant = await ProductVariant.findOne({ _id: variantId, product: productId });
    if (!variant) {
      throw httpError("Product variant not available", 400);
    }
    unitPriceDollars = variant.price ?? unitPriceDollars;
    sku = variant.sku || sku;
    name = `${product.title} — ${variant.display_name}`;
  }

  if (product.stock_control) {
    const available = await getTotalStockForProductVariant(productId, variantId || null);
    if (available < quantity) {
      throw httpError(`Insufficient stock for "${name}" — only ${available} left`, 400);
    }
  }

  return {
    product: product._id,
    variant: variant ? variant._id : null,
    name,
    sku,
    unit_price: Math.round(unitPriceDollars * 100), // dollars -> cents
    shipping_cost: product.shipping_cost ?? 0, // dollars, per-unit freight cost
    quantity,
  };
}

async function createOrder({ items, customer, shipping_address, billing_address }) {
  if (!Array.isArray(items) || !items.length) {
    throw httpError("Order must contain at least one item", 400);
  }

  const resolvedItems = [];
  for (const item of items) {
    resolvedItems.push(await resolveOrderItem(item));
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const shipping_cost = Math.round(
    resolvedItems.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0) * 100, // dollars -> cents
  );
  const total = subtotal + shipping_cost;
  const tax_amount = Math.round(subtotal / GST_DIVISOR); // GST already included in subtotal, display-only

  const order = await Order.create({
    order_number: await nextOrderNumber(),
    items: resolvedItems,
    customer,
    shipping_address,
    billing_address: billing_address || null,
    subtotal,
    shipping_cost,
    tax_amount,
    total,
    currency: "aud",
    status: ORDER_STATUS.PENDING_PAYMENT,
    guest_access_token: generateGuestAccessToken(),
  });

  return order;
}

// Resolves one mapped eBay line item to a stored order line — unlike
// resolveOrderItem() (storefront), we trust eBay's own price/title snapshot
// rather than re-deriving from the current Product, since that's what the
// buyer actually paid at the time. Returns null if the SKU doesn't match any
// known product/variant (e.g. a listing not managed through this app) so the
// caller can skip just that line instead of failing the whole import.
async function resolveEbayLineItem(lineItem) {
  if (!lineItem.sku) return null;

  const ids = await resolveSkuToIds(lineItem.sku);
  if (!ids) {
    logger.warn(`[order.service] eBay order line SKU not found locally: ${lineItem.sku}`);
    return null;
  }

  const product = await Product.findById(ids.productId).select("_id title sku").lean();
  if (!product) return null;
  const variant = ids.variantId
    ? await ProductVariant.findById(ids.variantId).select("_id sku display_name").lean()
    : null;

  return {
    product: product._id,
    variant: variant ? variant._id : null,
    name: lineItem.title || product.title,
    sku: lineItem.sku,
    unit_price: lineItem.unitPriceCents,
    quantity: lineItem.quantity,
  };
}

// Imports a paid eBay order into the same Order collection storefront orders
// live in (single source of truth for all channels). Idempotent on
// external_order_id — safe to call again on every poll cycle without
// creating duplicates. Returns null (not an error) when the order was
// already imported, or when none of its line items match a known product —
// callers should treat null as "nothing further to do", not a failure.
async function createOrderFromEbayOrder(rawEbayOrder) {
  const mapped = mapEbayOrder(rawEbayOrder, { ORDER_STATUS });
  if (!mapped.externalOrderId) {
    logger.warn("[order.service] eBay order payload missing orderId — skipping import");
    return null;
  }

  const existing = await Order.findOne({
    channel: ORDER_CHANNEL.EBAY,
    external_order_id: mapped.externalOrderId,
  });
  if (existing) return existing;

  const resolvedItems = [];
  for (const lineItem of mapped.lineItems) {
    const resolved = await resolveEbayLineItem(lineItem);
    if (resolved) resolvedItems.push(resolved);
  }

  if (!resolvedItems.length) {
    logger.warn(
      `[order.service] eBay order ${mapped.externalOrderId} has no line items matching a known product — skipping import`,
    );
    return null;
  }

  const order = await Order.create({
    order_number: await nextOrderNumber(),
    items: resolvedItems,
    customer: mapped.customer,
    shipping_address: mapped.shippingAddress,
    billing_address: null,
    subtotal: mapped.subtotalCents,
    shipping_cost: mapped.shippingCents,
    tax_amount: mapped.taxCents,
    total: mapped.totalCents,
    currency: "aud",
    status: mapped.status,
    channel: ORDER_CHANNEL.EBAY,
    external_order_id: mapped.externalOrderId,
    external_buyer_username: mapped.externalBuyerUsername,
    external_raw_payload: rawEbayOrder,
    guest_access_token: generateGuestAccessToken(),
  });

  logger.info(`[order.service] imported eBay order ${mapped.externalOrderId} as ${order.order_number}`);
  return order;
}

// Reflects an eBay order-level cancellation/return notification onto the
// matching local Order. No-op (returns null) if that eBay order was never
// imported here, e.g. its line items didn't match any known product —
// consistent with createOrderFromEbayOrder() treating that as "nothing to
// do" rather than an error. Doesn't create a Refund record: eBay-side
// refunds for these are settled through eBay's own managed payments, not
// our Stripe/Payment pipeline, so there's no Payment to link one to.
//
// eBay sends one LINE_ITEMS_UPDATED event per SKU, so a multi-item order
// can have just one line cancelled while the rest still ship — only flip
// the whole order's status when this notification covers every item on it;
// otherwise it's a partial cancellation and the status is left alone for
// manual reconciliation (the stock adjustment for that SKU still applies
// regardless, via the caller).
async function updateEbayOrderStatus(externalOrderId, { sku, quantity, status }) {
  const order = await Order.findOne({
    channel: ORDER_CHANNEL.EBAY,
    external_order_id: externalOrderId,
  });
  if (!order) return null;

  const isFullOrderCancellation =
    order.items.length === 1 && order.items[0].sku === sku && order.items[0].quantity === quantity;
  if (!isFullOrderCancellation) {
    logger.warn(
      `[order.service] eBay order ${externalOrderId}: partial cancellation/return (${sku} x${quantity}) — leaving status "${order.status}" as-is for manual review`,
    );
    return order;
  }

  order.status = status;
  await order.save();
  return order;
}

function safeTokenMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Public/guest lookup — requires the token issued once at creation. Returns
// a generic 404 (not 401/403) on a bad token so a guessed order ID doesn't
// even confirm the order exists.
async function getOrderForGuest(orderId, token) {
  const order = await Order.findById(orderId)
    .select("+guest_access_token")
    .populate("payment", "status card_brand card_last4 amount amount_refunded paid_at");
  if (!order || !safeTokenMatch(order.guest_access_token, token)) {
    throw httpError("Order not found", 404);
  }
  return order;
}

// ── Admin ────────────────────────────────────────────────────────────────

async function listOrders({ page = 1, limit = 20, skip = 0, status, channel, search } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ order_number: re }, { "customer.name": re }, { "customer.email": re }];
  }

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate("payment", "status amount amount_refunded card_brand card_last4 paid_at"),
    Order.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Full order record for the admin detail/invoice view — unlike
// getOrderForGuest, this isn't token-gated (route requires admin JWT auth
// instead) and includes the order's refund history for display alongside
// the populated payment.
async function getOrderDetailForAdmin(orderId) {
  const order = await Order.findById(orderId).populate("payment");
  if (!order) throw httpError("Order not found", 404);

  const refunds = await Refund.find({ order: order._id }).sort({ created_at: -1 });
  return { ...order.toObject(), refunds };
}

module.exports = {
  createOrder,
  getOrderForGuest,
  createOrderFromEbayOrder,
  updateEbayOrderStatus,
  listOrders,
  getOrderDetailForAdmin,
};
