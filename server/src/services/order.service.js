// services/order.service.js

const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Counter = require("../models/Counter");
const { getTotalStockForProductVariant } = require("./inventory.service");
const { ORDER_STATUS } = require("../constants/order.constants");

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
  const shipping_cost = 0; // free shipping for now — kept as a real field for future rates
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

module.exports = { createOrder, getOrderForGuest };
