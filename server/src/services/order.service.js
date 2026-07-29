// services/order.service.js

const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");
const Counter = require("../models/Counter");
const Refund = require("../models/Refund");
const { getTotalStockForProductVariant, resolveSkuToIds } = require("./inventory.service");
const { syncOrderStock, DIRECTION } = require("./order-stock-sync.service");
const { getTotalPaidForOrder, getTotalRefundedForOrder, getPaymentsForOrder } = require("./payment.service");
const { ORDER_STATUS, ORDER_CHANNEL, ORDER_DELIVERY_METHOD } = require("../constants/order.constants");
const { PAYMENT_PROVIDER, PAYMENT_STATUS, ORDER_PAYMENT_CHOICE } = require("../constants/payment.constants");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { derivePaymentStatus } = require("../utils/paymentStatus");
const { mapEbayOrder } = require("./ebay/ebay.order.mapper");
const { logger } = require("../loaders/logging");
const emailService = require("./email/email.service");
const { buildInvoicePdfBuffer } = require("../utils/pdf/invoicePdf");

// GST-inclusive AU retail pricing: GST component = price / 11, never added on top.
const GST_DIVISOR = 11;

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function formatCentsAsDollars(cents) {
  return `A$${(cents / 100).toFixed(2)}`;
}

async function nextOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "order_number" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `PHA-${String(counter.seq).padStart(5, "0")}`;
}

// Own sequence, own counter — kept separate from order_number so an
// invoice's numbering never has to assume "one order = one invoice" (see
// the comment on Order.invoice_number).
async function nextInvoiceNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "invoice_number" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `INV-${String(counter.seq).padStart(5, "0")}`;
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

// Resolves one line for a manual/in-store sale created from the admin
// dashboard. Unlike resolveOrderItem (storefront), doesn't require
// is_published_online — staff can sell draft/unlisted stock — and accepts a
// per-line discount entered by the staff member.
async function resolveManualOrderItem({
  product: productId,
  variant: variantId,
  quantity,
  discount_amount = 0,
  note = null,
}) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError("Invalid quantity", 400);
  }

  // Product/variant lookups are independent of each other — run them
  // concurrently rather than one-after-another, since createManualOrder
  // itself already fans this whole function out across every line item.
  const [product, variant] = await Promise.all([
    Product.findById(productId),
    variantId ? ProductVariant.findOne({ _id: variantId, product: productId }) : Promise.resolve(null),
  ]);
  if (!product) {
    throw httpError("Product not found", 400);
  }
  if (variantId && !variant) {
    throw httpError("Product variant not found", 400);
  }

  let unitPriceDollars = product.price;
  let sku = product.sku;
  let name = product.title;

  if (variant) {
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

  const unitPriceCents = Math.round(unitPriceDollars * 100);
  const lineSubtotalCents = unitPriceCents * quantity;
  const discountCents = Math.round(discount_amount * 100);
  if (discountCents < 0 || discountCents > lineSubtotalCents) {
    throw httpError(`Discount for "${name}" cannot exceed the line subtotal`, 400);
  }

  return {
    product: product._id,
    variant: variant ? variant._id : null,
    name,
    sku,
    unit_price: unitPriceCents,
    shipping_cost: product.shipping_cost ?? 0, // dollars, per-unit freight cost
    quantity,
    discount_amount: discountCents,
    note: note || null,
  };
}

// Admin-created in-person/counter sale — always linked to a known Customer
// record (found via search or just created on the fly by the caller), always
// channel MANUAL, and settled with whatever the staff member collected at
// the register rather than a Stripe payment intent. Stock is decremented
// immediately (unlike storefront, which waits for the Stripe webhook)
// because the goods leave with the customer now regardless of how much of
// the invoice is actually paid.
async function createManualOrder({
  customer_id,
  items,
  delivery_method = ORDER_DELIVERY_METHOD.PICKUP,
  shipping_address,
  billing_address,
  note,
  amount_paid = 0,
  payment_method,
}) {
  const customer = await Customer.findById(customer_id);
  if (!customer) {
    throw httpError("Customer not found", 400);
  }
  if (!Array.isArray(items) || !items.length) {
    throw httpError("Order must contain at least one item", 400);
  }

  // Each line item's own product/variant/stock lookups are independent of
  // every other line item — resolving them concurrently instead of one at a
  // time is what actually made multi-item in-store sales slow to create.
  const resolvedItems = await Promise.all(items.map(resolveManualOrderItem));

  const isPickup = delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  const subtotal = resolvedItems.reduce(
    (sum, i) => sum + (i.unit_price * i.quantity - i.discount_amount),
    0,
  );
  // Nothing to ship for pickup — skip the per-item shipping cost entirely
  // rather than charging for shipping that never happens. Mirrors createOrder
  // (storefront checkout) so a staff-created delivery order isn't silently free freight.
  const shipping_cost = isPickup
    ? 0
    : Math.round(
        resolvedItems.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0) * 100, // dollars -> cents
      );
  const tax_amount = Math.round(subtotal / GST_DIVISOR); // GST already included in subtotal, display-only
  const total = subtotal + shipping_cost;

  // "payment_link" means nothing is collected now — the customer pays later
  // via a Stripe-hosted link generated separately (see
  // createPaymentLinkForOrder) — so any amount_paid sent alongside it is
  // ignored rather than trusted.
  const isPaymentLink = payment_method === ORDER_PAYMENT_CHOICE.PAYMENT_LINK;
  const amountPaidCents = isPaymentLink ? 0 : Math.round(amount_paid * 100);
  if (amountPaidCents < 0 || amountPaidCents > total) {
    throw httpError("Amount paid cannot exceed the order total", 400);
  }

  const order = await Order.create({
    order_number: await nextOrderNumber(),
    invoice_number: await nextInvoiceNumber(),
    items: resolvedItems,
    customer: {
      name: customer.name,
      email: customer.email || null,
      phone: customer.phone || null,
    },
    customer_id: customer._id,
    delivery_method,
    shipping_address: isPickup ? null : shipping_address,
    billing_address: isPickup ? null : billing_address || null,
    note: note || null,
    subtotal,
    shipping_cost,
    tax_amount,
    total,
    currency: "aud",
    status: derivePaymentStatus(amountPaidCents, total),
    channel: ORDER_CHANNEL.MANUAL,
    guest_access_token: generateGuestAccessToken(),
  });

  const { hasShortfall, note: stockIssueNote } = await syncOrderStock(order, DIRECTION.DEDUCT, {
    reasonPrefix: "Manual sale",
    saleType: ADJUSTMENT_TYPE.MANUAL_SALE,
  });
  if (hasShortfall) {
    order.has_stock_issue = true;
    order.stock_issue_note = stockIssueNote;
  }

  // No Payment record at all when nothing was collected yet (invoice due in
  // full, or a payment link was chosen instead) — a Payment doc represents
  // money actually received, not an outstanding balance.
  if (amountPaidCents > 0) {
    const payment = await Payment.create({
      order: order._id,
      provider: PAYMENT_PROVIDER.MANUAL,
      payment_method,
      amount: amountPaidCents,
      currency: "aud",
      status: PAYMENT_STATUS.SUCCEEDED,
      paid_at: new Date(),
    });
    order.payment = payment._id;
  }

  await order.save();
  return order;
}

// Records a follow-up cash/online-transfer payment against an order that
// still has a balance outstanding — e.g. a manual-sale deposit followed by
// the customer settling the rest later, without a second Stripe payment
// link. Never touches stock: manual orders already had theirs deducted in
// full at createManualOrder() regardless of how much was actually collected.
async function recordOrderPayment(orderId, { payment_method, amount }) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw httpError("Order not found", 404);
  }
  // Storefront/eBay orders are only ever settled through Stripe (their stock
  // deduction is gated on that webhook firing) — a staff-recorded cash/
  // transfer payment only makes sense for a manual/in-store sale, whose
  // stock was already deducted up front at creation regardless of payment.
  if (order.channel !== ORDER_CHANNEL.MANUAL) {
    throw httpError("Only manual orders can have a payment recorded against them", 400);
  }
  if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIALLY_PAID].includes(order.status)) {
    throw httpError("This order has no outstanding balance to collect", 409);
  }

  const totalPaidCents = await getTotalPaidForOrder(order._id);
  const remainingCents = order.total - totalPaidCents;
  const amountCents = Math.round(amount * 100);
  if (amountCents <= 0 || amountCents > remainingCents) {
    throw httpError(`Amount must be between $0.01 and ${formatCentsAsDollars(remainingCents)}`, 400);
  }

  const payment = await Payment.create({
    order: order._id,
    provider: PAYMENT_PROVIDER.MANUAL,
    payment_method,
    amount: amountCents,
    currency: order.currency,
    status: PAYMENT_STATUS.SUCCEEDED,
    paid_at: new Date(),
  });

  order.payment = payment._id;
  order.status = derivePaymentStatus(totalPaidCents + amountCents, order.total);
  await order.save();

  return order;
}

// Corrects the order's OWN customer/address snapshot (e.g. a mistyped
// email, an updated phone number) — deliberately never touches the linked
// Customer record even when customer_id is set. Orders are a historical
// record and this snapshot is already independent of the master Customer
// profile (see Order.js's `customer` field) — the same separation applies
// here, so this only ever corrects what's on this specific invoice.
async function updateOrderCustomerDetails(orderId, { customer, shipping_address, billing_address }) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw httpError("Order not found", 404);
  }

  if (customer) {
    if (customer.name !== undefined) order.customer.name = customer.name;
    if (customer.email !== undefined) order.customer.email = customer.email || null;
    if (customer.phone !== undefined) order.customer.phone = customer.phone || null;
  }

  // Pickup orders carry no address at all — silently ignore address fields
  // sent for one rather than erroring, since the client shouldn't need to
  // know this order's delivery_method before deciding what to send.
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  if (!isPickup) {
    if (shipping_address !== undefined) order.shipping_address = shipping_address;
    if (billing_address !== undefined) order.billing_address = billing_address || null;
  }

  await order.save();
  return order;
}

// Channels whose line items/shipping can be corrected after the fact —
// storefront prices are the storefront's own listed price (editing it here
// would desync from what the customer actually saw at checkout), so that
// channel is deliberately excluded from all three functions below.
const EDITABLE_CHANNELS = [ORDER_CHANNEL.EBAY, ORDER_CHANNEL.MANUAL];

// Corrects a single line item's price on an eBay or manual order — e.g. a
// listing that synced with the wrong price, or a staff mis-key at the
// register. Recomputes subtotal/tax_amount/total the same way order creation
// does, so the invoice always reflects live line-item data rather than a
// stale creation-time snapshot. Note: if the order was already paid before
// this edit, the new total can diverge from what was actually collected —
// that's surfaced to staff via the order's Balance Outstanding figure for
// manual reconciliation, not auto-resolved here (no refund/extra-charge is
// triggered).
async function updateOrderItemPrice(orderId, itemIndex, { unit_price, userId }) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw httpError("Order not found", 404);
  }
  if (!EDITABLE_CHANNELS.includes(order.channel)) {
    throw httpError("Only eBay and in-store order prices can be edited after the fact", 400);
  }
  const item = order.items[itemIndex];
  if (!item) {
    throw httpError("Order item not found", 404);
  }
  if (!Number.isFinite(unit_price) || unit_price <= 0) {
    throw httpError("Unit price must be greater than 0", 400);
  }

  const unitPriceCents = Math.round(unit_price * 100);
  if (item.original_unit_price === null) {
    item.original_unit_price = item.unit_price;
  }
  item.unit_price = unitPriceCents;
  item.unit_price_updated_at = new Date();
  item.unit_price_updated_by = userId || null;

  order.subtotal = order.items.reduce((sum, i) => sum + (i.unit_price * i.quantity - i.discount_amount), 0);
  order.tax_amount = Math.round(order.subtotal / GST_DIVISOR);
  order.total = order.subtotal - order.discount_amount + order.shipping_cost;

  await order.save();
  return order;
}

// Corrects the order's freight charge after the fact — e.g. a shipping quote
// that turned out wrong. eBay and manual orders only, same reasoning as
// updateOrderItemPrice. Mirrors its recompute of tax_amount/total; same "no
// auto refund/extra-charge" caveat applies if the order was already paid.
async function updateOrderShippingCost(orderId, { shipping_cost }) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw httpError("Order not found", 404);
  }
  if (!EDITABLE_CHANNELS.includes(order.channel)) {
    throw httpError("Only eBay and in-store order shipping costs can be edited after the fact", 400);
  }
  if (!Number.isFinite(shipping_cost) || shipping_cost < 0) {
    throw httpError("Shipping cost cannot be negative", 400);
  }

  order.shipping_cost = Math.round(shipping_cost * 100);
  order.total = order.subtotal - order.discount_amount + order.shipping_cost;
  if (order.total < 0) {
    throw httpError("Shipping cost would make the order total negative", 400);
  }

  await order.save();
  return order;
}

// Corrects a single line item's discount on an eBay or manual order —
// discount is applied per line item (not as one order-level lump), so
// staff have exactly one place to change it. eBay and manual orders only,
// same reasoning as updateOrderItemPrice. Mirrors its recompute of
// subtotal/tax_amount/total; same "no auto refund/extra-charge" caveat
// applies if the order was already paid.
async function updateOrderItemDiscount(orderId, itemIndex, { discount_amount }) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw httpError("Order not found", 404);
  }
  if (!EDITABLE_CHANNELS.includes(order.channel)) {
    throw httpError("Only eBay and in-store order discounts can be edited after the fact", 400);
  }
  const item = order.items[itemIndex];
  if (!item) {
    throw httpError("Order item not found", 404);
  }
  if (!Number.isFinite(discount_amount) || discount_amount < 0) {
    throw httpError("Discount cannot be negative", 400);
  }

  const discountCents = Math.round(discount_amount * 100);
  const lineSubtotalCents = item.unit_price * item.quantity;
  if (discountCents > lineSubtotalCents) {
    throw httpError("Discount cannot exceed the line subtotal", 400);
  }

  item.discount_amount = discountCents;

  order.subtotal = order.items.reduce((sum, i) => sum + (i.unit_price * i.quantity - i.discount_amount), 0);
  order.tax_amount = Math.round(order.subtotal / GST_DIVISOR);
  order.total = order.subtotal - order.discount_amount + order.shipping_cost;

  await order.save();
  return order;
}

// Adds a staff comment to an order's internal notes thread — distinct from
// the customer-facing `note` captured once at creation.
async function addOrderNote(orderId, { text, userId }) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw httpError("Order not found", 404);
  }
  order.internal_notes.push({ text, author: userId || null, created_at: new Date() });
  await order.save();
  return order;
}

async function createOrder({
  items,
  customer,
  shipping_address,
  billing_address,
  delivery_method = ORDER_DELIVERY_METHOD.DELIVERY,
}) {
  if (!Array.isArray(items) || !items.length) {
    throw httpError("Order must contain at least one item", 400);
  }

  const resolvedItems = [];
  for (const item of items) {
    resolvedItems.push(await resolveOrderItem(item));
  }

  const isPickup = delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  const subtotal = resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  // Nothing to ship for pickup — skip the per-item shipping cost entirely
  // rather than charging for shipping that never happens.
  const shipping_cost = isPickup
    ? 0
    : Math.round(
        resolvedItems.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0) * 100, // dollars -> cents
      );
  const total = subtotal + shipping_cost;
  const tax_amount = Math.round(subtotal / GST_DIVISOR); // GST already included in subtotal, display-only

  const order = await Order.create({
    order_number: await nextOrderNumber(),
    invoice_number: await nextInvoiceNumber(),
    items: resolvedItems,
    customer,
    delivery_method,
    shipping_address: isPickup ? null : shipping_address,
    billing_address: isPickup ? null : billing_address || null,
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
    invoice_number: await nextInvoiceNumber(),
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

  // eBay collects payment on their end (Managed Payments) before the order
  // ever reaches us — mapped.status is always PAID/FULFILLED, never
  // PENDING_PAYMENT (see mapStatus()), so the full total is recorded as
  // already collected. Without this, every eBay order looked unpaid to the
  // rest of the app (balance-due banners, invoice totals, payment history)
  // since nothing else ever creates a Payment for this channel.
  const payment = await Payment.create({
    order: order._id,
    provider: PAYMENT_PROVIDER.EBAY,
    amount: order.total,
    currency: order.currency,
    status: PAYMENT_STATUS.SUCCEEDED,
    paid_at: order.created_at,
  });
  order.payment = payment._id;
  await order.save();

  logger.info(`[order.service] imported eBay order ${mapped.externalOrderId} as ${order.order_number}`);
  return order;
}

// Reflects an eBay order-level cancellation/return notification onto the
// matching local Order. No-op (returns null) if that eBay order was never
// imported here, e.g. its line items didn't match any known product —
// consistent with createOrderFromEbayOrder() treating that as "nothing to
// do" rather than an error. Doesn't create a Refund record automatically:
// eBay-side refunds are settled through eBay's own managed payments, not
// ours, so there's nothing for us to actually reverse here — staff can
// still record a manual refund against the order's Payment (see
// refund.service.js#createManualRefund) if they want it reflected locally.
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
    .populate("payment", "provider payment_method status card_brand card_last4 amount amount_refunded paid_at");
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
      .populate("payment", "provider payment_method status amount amount_refunded card_brand card_last4 paid_at"),
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
// instead) and includes the order's full payment + refund history, rather
// than just the single most-recently-created Payment `order.payment` points
// at (which a deposit + follow-up payment would make incomplete/stale).
async function getOrderDetailForAdmin(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw httpError("Order not found", 404);

  const [payments, refunds] = await Promise.all([
    getPaymentsForOrder(order._id),
    Refund.find({ order: order._id }).sort({ created_at: -1 }),
  ]);

  const { payment, ...orderFields } = order.toObject();
  return { ...orderFields, payments, refunds };
}

// Admin action triggered by the "Send Email" button on the order detail
// page. DELIVERY orders require tracking info the first time — capturing it
// here IS the fulfilment step, so the order transitions to FULFILLED in the
// same write. Once tracking is on file, re-sending (e.g. the customer says
// they missed the email) reuses it instead of asking again; passing new
// tracking_number/carrier_name always overwrites what's on file. Both paths
// attach the same tax invoice PDF; only the accompanying email
// (shipped-with-tracking vs ready-for-pickup) differs.
async function sendOrderNotification(orderId, { tracking_number, carrier_name } = {}) {
  const order = await Order.findById(orderId).populate("payment");
  if (!order) throw httpError("Order not found", 404);

  // Sums every succeeded Payment on the order, not just the most recently
  // created one (order.payment) — a manual sale can have a deposit plus a
  // separate follow-up payment, and the invoice must reflect both.
  const [totalPaidCents, totalRefundedCents] = await Promise.all([
    getTotalPaidForOrder(order._id),
    getTotalRefundedForOrder(order._id),
  ]);

  // In-person sales are already complete when created — no shipped/pickup
  // framing applies, just the invoice (with the outstanding balance called
  // out, if any) attached to a plain receipt email.
  if (order.channel === ORDER_CHANNEL.MANUAL) {
    if (!order.customer.email) {
      throw httpError("This customer has no email on file — add one before sending an invoice", 400);
    }
    const pdfBuffer = await buildInvoicePdfBuffer(order.toObject(), { totalPaidCents, totalRefundedCents });
    const amountDueCents = order.total - totalPaidCents;
    await emailService.sendManualOrderReceipt({
      to: order.customer.email,
      name: order.customer.name,
      orderNumber: order.order_number,
      amountDue: amountDueCents > 0 ? formatCentsAsDollars(amountDueCents) : null,
      pdfBase64: pdfBuffer.toString("base64"),
      pdfFilename: `${order.order_number}-invoice.pdf`,
    });
    return order;
  }

  const isDelivery = order.delivery_method === ORDER_DELIVERY_METHOD.DELIVERY;

  if (isDelivery) {
    const trimmedTracking = tracking_number?.trim();
    const trimmedCarrier = carrier_name?.trim();

    if (trimmedTracking && trimmedCarrier) {
      order.tracking_number = trimmedTracking;
      order.carrier_name = trimmedCarrier;
      order.status = ORDER_STATUS.FULFILLED;
      await order.save();
    } else if (!order.tracking_number || !order.carrier_name) {
      throw httpError("Tracking number and carrier name are required to notify a delivery order", 400);
    }
  }

  const pdfBuffer = await buildInvoicePdfBuffer(order.toObject(), { totalPaidCents, totalRefundedCents });
  const pdfBase64 = pdfBuffer.toString("base64");
  const pdfFilename = `${order.order_number}-invoice.pdf`;

  if (isDelivery) {
    await emailService.sendOrderShipped({
      to: order.customer.email,
      name: order.customer.name,
      orderNumber: order.order_number,
      trackingNumber: order.tracking_number,
      carrierName: order.carrier_name,
      pdfBase64,
      pdfFilename,
    });
  } else {
    await emailService.sendOrderReadyForPickup({
      to: order.customer.email,
      name: order.customer.name,
      orderNumber: order.order_number,
      pdfBase64,
      pdfFilename,
    });
  }

  return order;
}

// Admin action triggered by the "Download PDF" button on the order detail
// page — the same pdfkit-rendered tax invoice emailed via sendOrderNotification,
// just handed straight to the browser instead of attached to an email. Kept as
// its own read-only fetch (rather than reusing sendOrderNotification) since
// downloading never needs the tracking-number capture/fulfilment side effect
// that function has for delivery orders.
async function getInvoicePdfForOrder(orderId) {
  const order = await Order.findById(orderId).populate("payment");
  if (!order) throw httpError("Order not found", 404);

  const [totalPaidCents, totalRefundedCents] = await Promise.all([
    getTotalPaidForOrder(order._id),
    getTotalRefundedForOrder(order._id),
  ]);
  const pdfBuffer = await buildInvoicePdfBuffer(order.toObject(), { totalPaidCents, totalRefundedCents });

  return { pdfBuffer, orderNumber: order.order_number };
}

module.exports = {
  createOrder,
  createManualOrder,
  recordOrderPayment,
  updateOrderCustomerDetails,
  getOrderForGuest,
  createOrderFromEbayOrder,
  updateEbayOrderStatus,
  listOrders,
  getOrderDetailForAdmin,
  sendOrderNotification,
  getInvoicePdfForOrder,
  addOrderNote,
  updateOrderItemPrice,
  updateOrderShippingCost,
  updateOrderItemDiscount,
};
