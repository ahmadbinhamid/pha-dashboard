// services/order.service.js

const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Payment = require("../models/Payment");
const Counter = require("../models/Counter");
const Refund = require("../models/Refund");
const Tenant = require("../models/Tenant");
const { tenantCounterKey } = require("../utils/tenantCounterKey");
const { buildWordSearchOr } = require("../utils/regex");
const { excludeAbandonedCheckouts, notCancelled, awaitingPayment, overdueInvoices } = require("../utils/orderVisibility");
const { formatCentsAsDollars } = require("../utils/currency");
const { formatOrderNumber, stripOrderNumberPrefix } = require("../utils/orderNumberFormat");
const { getTotalStockForProductVariant, resolveSkuToIds } = require("./inventory.service");
const { syncOrderStock, DIRECTION } = require("./order-stock-sync.service");
const {
  getTotalPaidForOrder,
  getTotalRefundedForOrder,
  getPaymentsForOrder,
  getAmountDueForOrder,
} = require("./payment.service");
const {
  UNPAID_ORDER_STATUSES,
  UNPAID_ORDER_PAYMENT_STATUSES,
  ORDER_STATUS,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_FULFILLMENT_STATUS,
  ORDER_PAYMENT_STATUS,
} = require("../constants/order.constants");
const { PAYMENT_PROVIDER, PAYMENT_STATUS, ORDER_PAYMENT_CHOICE } = require("../constants/payment.constants");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { currencyForMarketplace } = require("../constants/ebay.constants");
const { derivePaymentStatus, deriveLegacyOrderStatus } = require("../utils/paymentStatus");
const { mapEbayOrder } = require("./ebay/ebay.order.mapper");
const { createPaymentLinkForOrder } = require("./stripe/stripe.payment.service");
const { logger } = require("../loaders/logging");
const emailService = require("./email/email.service");
const { buildInvoicePdfBuffer } = require("../utils/pdf/invoicePdf");
const {
  resolveCheckoutDiscount,
  reserveRedemption,
  attachRedemptionOrder,
  releaseRedemption,
  releaseOrderRedemption,
} = require("./discount-pricing.service");
const { upsertStorefrontCustomer, getCustomerForOrder } = require("./customer.service");
const { getCompanyProfile } = require("./tenant-settings.service");
const notificationService = require("./notification.service");
const { quoteCart, hasCalculatedShipping, findPickupOnlyTitles } = require("./shipping/shipping-quote.service");
const { computeOrderTotals } = require("../utils/orderTotals");
const { addDays } = require("../utils/date");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Bare number, prefix applied at render, so it never mimics a SKU.
function padSequence(seq) {
  return String(seq).padStart(5, "0");
}

async function nextOrderNumber(tenantId) {
  const counter = await Counter.findOneAndUpdate(
    { _id: tenantCounterKey(tenantId, "order_number") },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return padSequence(counter.seq);
}

// Own sequence: invoice numbering must not assume one order = one invoice.
async function nextInvoiceNumber(tenantId) {
  const counter = await Counter.findOneAndUpdate(
    { _id: tenantCounterKey(tenantId, "invoice_number") },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return padSequence(counter.seq);
}

function generateGuestAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Line snapshot of the product's condition chips for invoices.
function productAttributes(product) {
  return { condition: product.condition ?? null, authenticity: product.authenticity ?? null };
}

// Pre-snapshot lines read the current product, in one query per order.
async function withItemAttributes(order) {
  const stale = order.items.filter((i) => i.product && i.condition == null);
  if (!stale.length) return order;
  const products = await Product.find({ _id: { $in: stale.map((i) => i.product) }, tenant_id: order.tenant_id })
    .select("condition authenticity")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), productAttributes(p)]));
  const items = order.items.map((i) => (i.condition == null && i.product ? { ...i, ...byId.get(String(i.product)) } : i));
  return { ...order, items };
}

// Re-derives price/availability from the DB, cart totals are never trusted.
async function resolveOrderItem({ product: productId, variant: variantId, quantity }, tenantId) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError("Invalid quantity", 400);
  }

  const product = await Product.findOne({ _id: productId, tenant_id: tenantId });
  if (!product || !product.is_published_online) {
    throw httpError("Product not available", 400);
  }

  let variant = null;
  let unitPriceDollars = product.price;
  let sku = product.sku;
  let name = product.title;

  if (variantId) {
    variant = await ProductVariant.findOne({ _id: variantId, product: productId, tenant_id: tenantId });
    if (!variant) {
      throw httpError("Product variant not available", 400);
    }
    unitPriceDollars = variant.price ?? unitPriceDollars;
    sku = variant.sku || sku;
    name = `${product.title} (${variant.display_name})`;
  }

  if (product.stock_control) {
    const available = await getTotalStockForProductVariant(productId, variantId || null);
    if (available < quantity) {
      throw httpError(`Insufficient stock for "${name}". Only ${available} left`, 400);
    }
  }

  return {
    product: product._id,
    variant: variant ? variant._id : null,
    name,
    sku,
    ...productAttributes(product),
    unit_price: Math.round(unitPriceDollars * 100), // dollars -> cents
    shipping_cost: product.shipping_cost ?? 0, // dollars, per-unit freight cost
    quantity,
  };
}

// Manual sale line: skips is_published_online check, allows line discount.
async function resolveManualOrderItem(
  { product: productId, variant: variantId, quantity, discount_amount = 0, note = null },
  tenantId,
) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError("Invalid quantity", 400);
  }

  // Lookups are independent, so run them concurrently.
  const [product, variant] = await Promise.all([
    Product.findOne({ _id: productId, tenant_id: tenantId }),
    variantId
      ? ProductVariant.findOne({ _id: variantId, product: productId, tenant_id: tenantId })
      : Promise.resolve(null),
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
    name = `${product.title} (${variant.display_name})`;
  }

  if (product.stock_control) {
    const available = await getTotalStockForProductVariant(productId, variantId || null);
    if (available < quantity) {
      throw httpError(`Insufficient stock for "${name}". Only ${available} left`, 400);
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
    ...productAttributes(product),
    unit_price: unitPriceCents,
    shipping_cost: product.shipping_cost ?? 0, // dollars, per-unit freight cost
    quantity,
    discount_amount: discountCents,
    note: note || null,
  };
}

// Order-only line: no product, no sku, so stock sync and eBay skip it.
function resolveCustomOrderItem({
  name,
  unit_price,
  shipping_cost = 0,
  quantity = 1,
  discount_amount = 0,
  note = null,
  condition = null,
  authenticity = null,
}) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError("Invalid quantity", 400);
  }
  const unitPriceCents = Math.round(unit_price * 100);
  if (!name || unitPriceCents <= 0) {
    throw httpError("Custom product needs a title and a price", 400);
  }
  const discountCents = Math.round(discount_amount * 100);
  if (discountCents < 0 || discountCents > unitPriceCents * quantity) {
    throw httpError(`Discount for "${name}" cannot exceed the line subtotal`, 400);
  }

  return {
    product: null,
    variant: null,
    is_custom: true,
    name,
    sku: null,
    condition: condition || null,
    authenticity: authenticity || null,
    unit_price: unitPriceCents,
    shipping_cost: shipping_cost ?? 0, // dollars, per unit
    quantity,
    discount_amount: discountCents,
    note: note || null,
  };
}

// Locks the business's account terms onto a new order.
function paymentTermsFor(business, issuedAt = new Date()) {
  const days = business?.payment_terms_days ?? null;
  return { payment_terms_days: days, due_date: days ? addDays(issuedAt, days) : null };
}

// Stock drops now: goods leave with the customer whatever is paid.
async function createManualOrder(
  {
    customer_id,
    items,
    delivery_method = ORDER_DELIVERY_METHOD.PICKUP,
    shipping_address,
    billing_address,
    note,
    reference_number,
    amount_paid = 0,
    payment_method,
    shipping_cost: shippingCostOverride,
  },
  tenant,
) {
  const customer = await getCustomerForOrder(customer_id, tenant._id);
  if (!customer) {
    throw httpError("Customer not found", 400);
  }
  if (!Array.isArray(items) || !items.length) {
    throw httpError("Order must contain at least one item", 400);
  }

  // Resolve lines concurrently to keep multi-item sales fast.
  const resolvedItems = await Promise.all(
    items.map((item) =>
      item.is_custom ? resolveCustomOrderItem(item) : resolveManualOrderItem(item, tenant._id),
    ),
  );

  const isPickup = delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  // Only carrier delivery is charged; the override beats the per-item sum.
  const shipping_cost = delivery_method !== ORDER_DELIVERY_METHOD.DELIVERY
    ? 0
    : shippingCostOverride != null
      ? Math.round(shippingCostOverride * 100)
      : Math.round(
          resolvedItems.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0) * 100, // dollars -> cents
        );
  const { subtotal, tax_amount, total } = computeOrderTotals(resolvedItems, { shippingCost: shipping_cost });

  // "payment_link" collects nothing now, so any amount_paid is ignored.
  const isPaymentLink = payment_method === ORDER_PAYMENT_CHOICE.PAYMENT_LINK;
  const amountPaidCents = isPaymentLink ? 0 : Math.round(amount_paid * 100);
  if (amountPaidCents < 0 || amountPaidCents > total) {
    throw httpError("Amount paid cannot exceed the order total", 400);
  }

  const order = await Order.create({
    tenant_id: tenant._id,
    order_number: await nextOrderNumber(tenant._id),
    order_number_prefix: tenant.order_number_prefix,
    invoice_number: await nextInvoiceNumber(tenant._id),
    invoice_number_prefix: tenant.invoice_number_prefix,
    items: resolvedItems,
    customer: {
      name: customer.name,
      company_name: customer.business?.name ?? null,
      email: customer.email || null,
      phone: customer.phone || null,
    },
    customer_id: customer._id,
    business_id: customer.business_id,
    ...paymentTermsFor(customer.business),
    delivery_method,
    shipping_address: isPickup ? null : shipping_address,
    billing_address: isPickup ? null : billing_address || null,
    note: note || null,
    reference_number: reference_number || null,
    subtotal,
    shipping_cost,
    tax_amount,
    total,
    currency: "aud",
    // createRefund's admission check gates on payment_status.
    status: derivePaymentStatus(amountPaidCents, total),
    payment_status: derivePaymentStatus(amountPaidCents, total),
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

  // No Payment when nothing was collected, a Payment means money received.
  if (amountPaidCents > 0) {
    const payment = await Payment.create({
      tenant_id: tenant._id,
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

  // Best-effort: notification failures must never fail order creation.
  try {
    await notificationService.notifyNewOrder(tenant._id, order);
  } catch (err) {
    logger.error(`[order.service] failed to notify new manual order ${order.order_number}`, { error: err.message });
  }

  return order;
}

// Never touches stock, createManualOrder already deducted it in full.
async function recordOrderPayment(orderId, { payment_method, amount }, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) {
    throw httpError("Order not found", 404);
  }
  // Only manual sales take staff payments, storefront/eBay settle via Stripe.
  if (order.channel !== ORDER_CHANNEL.MANUAL) {
    throw httpError("Only manual orders can have a payment recorded against them", 400);
  }
  if (!UNPAID_ORDER_STATUSES.includes(order.status)) {
    throw httpError("This order has no outstanding balance to collect", 409);
  }

  const totalPaidCents = await getTotalPaidForOrder(order._id);
  const remainingCents = order.total - totalPaidCents;
  const amountCents = Math.round(amount * 100);
  if (amountCents <= 0 || amountCents > remainingCents) {
    throw httpError(`Amount must be between $0.01 and ${formatCentsAsDollars(remainingCents)}`, 400);
  }

  const payment = await Payment.create({
    tenant_id: tenantId,
    order: order._id,
    provider: PAYMENT_PROVIDER.MANUAL,
    payment_method,
    amount: amountCents,
    currency: order.currency,
    status: PAYMENT_STATUS.SUCCEEDED,
    paid_at: new Date(),
  });

  // Set payment_status alongside legacy status, not instead of it.
  const derivedStatus = derivePaymentStatus(totalPaidCents + amountCents, order.total);
  // One write that bumps __v, so an in-flight line edit fails its version check.
  return Order.findOneAndUpdate(
    { _id: order._id },
    { $set: { payment: payment._id, status: derivedStatus, payment_status: derivedStatus }, $inc: { __v: 1 } },
    { new: true },
  );
}

// Never updates the linked Customer, orders are a historical snapshot.
async function updateOrderCustomerDetails(orderId, { customer, shipping_address, billing_address }, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) {
    throw httpError("Order not found", 404);
  }

  if (customer) {
    if (customer.name !== undefined) order.customer.name = customer.name;
    if (customer.email !== undefined) order.customer.email = customer.email || null;
    if (customer.phone !== undefined) order.customer.phone = customer.phone || null;
  }

  // Pickup orders carry no address, so address fields are silently ignored.
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  if (!isPickup) {
    if (shipping_address !== undefined) order.shipping_address = shipping_address;
    if (billing_address !== undefined) order.billing_address = billing_address || null;
  }

  await order.save();
  return order;
}

// Staff reference (e.g. PO number), distinct from system-generated numbers.
async function updateOrderReferenceNumber(orderId, { reference_number }, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) {
    throw httpError("Order not found", 404);
  }

  order.reference_number = reference_number || null;

  await order.save();
  return order;
}

// Internal staff note, distinct from the customer-facing `note`.
async function addOrderNote(orderId, { text, userId }, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) {
    throw httpError("Order not found", 404);
  }
  order.internal_notes.push({ text, author: userId || null, created_at: new Date() });
  await order.save();
  return order;
}

// Flat per-unit rates, or a Transdirect quote when any product needs one.
async function orderShippingCents(tenantId, items, resolvedItems, shippingAddress) {
  const flatCents = Math.round(resolvedItems.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0) * 100);
  if (!(await hasCalculatedShipping(tenantId, items))) return flatCents;
  const quote = await quoteCart(tenantId, { items, receiver: shippingAddress });
  return quote.shipping_cost;
}

// Delivery orders can't include products sold for in-store pickup only.
async function assertDeliverable(tenantId, items) {
  const titles = await findPickupOnlyTitles(tenantId, items);
  if (titles.length) throw httpError(`In-store pickup only: ${titles.join(", ")}`, 400);
}

// `tenant` comes from the storefront identifier, not a JWT, no staff user.
async function createOrder(
  {
    items,
    customer,
    shipping_address,
    billing_address,
    delivery_method = ORDER_DELIVERY_METHOD.DELIVERY,
    promo_code,
    marketing_opt_in = false,
  },
  tenant,
) {
  if (!Array.isArray(items) || !items.length) {
    throw httpError("Order must contain at least one item", 400);
  }

  const isPickup = delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  if (!isPickup) await assertDeliverable(tenant._id, items);

  const resolvedItems = await resolveGuestItems(items, tenant._id);

  // Pickup ships nothing, otherwise flat rates plus any calculated quote.
  const baseShipping = isPickup ? 0 : await orderShippingCents(tenant._id, items, resolvedItems, shipping_address);
  const [priorOrders, savedCustomer] = await Promise.all([
    countPaidStorefrontOrders(tenant._id, customer.email),
    upsertStorefrontCustomer(tenant._id, { ...customer, marketing_opt_in }),
  ]);
  const priced = await resolveCheckoutDiscount(tenant._id, {
    code: promo_code,
    items: resolvedItems,
    shippingCents: baseShipping,
    customerEmail: customer.email,
    priorOrders,
  });
  const { shipping_cost, discount } = priced;
  const { subtotal, tax_amount, total } = computeOrderTotals(priced.items, { shippingCost: shipping_cost });

  return createWithRedemption(discount, { tenantId: tenant._id, customerEmail: customer.email, amount: priced.amount, orderTotal: total }, async () =>
    Order.create({
    tenant_id: tenant._id,
    order_number: await nextOrderNumber(tenant._id),
    order_number_prefix: tenant.order_number_prefix,
    invoice_number: await nextInvoiceNumber(tenant._id),
    invoice_number_prefix: tenant.invoice_number_prefix,
    items: priced.items,
    discount_id: discount?._id ?? null,
    promo_code: discount?.code ?? null,
    customer,
    customer_id: savedCustomer._id,
    business_id: savedCustomer.business_id ?? null,
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
    }),
  );
}

// Paid or part-refunded counts, cancelled or fully refunded never does.
const COUNTED_PAYMENT_STATUSES = [ORDER_PAYMENT_STATUS.PAID, ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED];

/** Prior paid, uncancelled website orders on this email (returning check). */
async function countPaidStorefrontOrders(tenantId, email) {
  if (!email) return null;
  return Order.countDocuments({
    tenant_id: tenantId,
    channel: ORDER_CHANNEL.STOREFRONT,
    "customer.email": String(email).trim().toLowerCase(),
    payment_status: { $in: COUNTED_PAYMENT_STATUSES },
    fulfillment_status: { $ne: ORDER_FULFILLMENT_STATUS.CANCELLED },
  });
}

async function resolveGuestItems(items, tenantId) {
  const resolved = [];
  for (const item of items) resolved.push(await resolveOrderItem(item, tenantId));
  return resolved;
}

// Claims the discount use before the order exists, released if create fails.
async function createWithRedemption(discount, reservation, createOrderDoc) {
  if (!discount) return createOrderDoc();
  const redemption = await reserveRedemption(discount, reservation);
  try {
    const order = await createOrderDoc();
    await attachRedemptionOrder(redemption._id, order._id);
    return order;
  } catch (err) {
    await releaseRedemption(redemption);
    throw err;
  }
}

/** Storefront cart preview of the order's discount, prices nothing for real. */
async function quoteOrderDiscount({ items, promo_code, shipping_cents = 0, customer_email }, tenant) {
  const [resolvedItems, priorOrders] = await Promise.all([
    resolveGuestItems(items, tenant._id),
    countPaidStorefrontOrders(tenant._id, customer_email),
  ]);
  const { discount, amount, shipping_cost } = await resolveCheckoutDiscount(tenant._id, {
    code: promo_code,
    items: resolvedItems,
    shippingCents: shipping_cents,
    customerEmail: customer_email,
    priorOrders,
  });
  if (!discount) return { discount: null, amount: 0, shipping_waived: false };
  const { name, code, is_automatic, discount_type, discount_value, min_order_number, max_order_number } = discount;
  return {
    discount: { name, code, is_automatic, discount_type, discount_value, min_order_number, max_order_number },
    amount,
    shipping_waived: shipping_cents > 0 && shipping_cost === 0,
  };
}

// Trusts eBay's price/title (what buyer paid), null for an unknown SKU.
async function resolveEbayLineItem(lineItem, tenantId) {
  if (!lineItem.sku) return null;

  // Tenant-scoped re-fetch: cheap defense-in-depth vs resolveSkuToIds bugs.
  const ids = await resolveSkuToIds(lineItem.sku, tenantId);
  if (!ids) {
    logger.warn(`[order.service] eBay order line SKU not found locally: ${lineItem.sku}`);
    return null;
  }

  const product = await Product.findOne({ _id: ids.productId, tenant_id: tenantId }).select("_id title sku condition authenticity").lean();
  if (!product) return null;
  const variant = ids.variantId
    ? await ProductVariant.findOne({ _id: ids.variantId, tenant_id: tenantId }).select("_id sku display_name").lean()
    : null;

  return {
    product: product._id,
    variant: variant ? variant._id : null,
    name: lineItem.title || product.title,
    sku: lineItem.sku,
    ...productAttributes(product),
    unit_price: lineItem.unitPriceCents,
    quantity: lineItem.quantity,
  };
}

// Idempotent on external_order_id, null if imported or no SKU matches.
async function createOrderFromEbayOrder(rawEbayOrder, tenant, settings) {
  const mapped = mapEbayOrder(rawEbayOrder, { ORDER_STATUS });
  if (!mapped.externalOrderId) {
    logger.warn("[order.service] eBay order payload missing orderId, skipping import");
    return null;
  }

  const existing = await Order.findOne({
    tenant_id: tenant._id,
    channel: ORDER_CHANNEL.EBAY,
    external_order_id: mapped.externalOrderId,
  });
  if (existing) return existing;

  const resolvedItems = [];
  for (const lineItem of mapped.lineItems) {
    const resolved = await resolveEbayLineItem(lineItem, tenant._id);
    if (resolved) resolvedItems.push(resolved);
  }

  if (!resolvedItems.length) {
    logger.warn(
      `[order.service] eBay order ${mapped.externalOrderId} has no line items matching a known product, skipping import`,
    );
    return null;
  }

  const order = await Order.create({
    tenant_id: tenant._id,
    order_number: await nextOrderNumber(tenant._id),
    order_number_prefix: tenant.order_number_prefix,
    invoice_number: await nextInvoiceNumber(tenant._id),
    invoice_number_prefix: tenant.invoice_number_prefix,
    items: resolvedItems,
    customer: mapped.customer,
    shipping_address: mapped.shippingAddress,
    billing_address: null,
    subtotal: mapped.subtotalCents,
    shipping_cost: mapped.shippingCents,
    tax_amount: mapped.taxCents,
    total: mapped.totalCents,
    // Prefer eBay's currency, tenant marketplace currency only if absent.
    currency: (mapped.currency || currencyForMarketplace(settings?.marketplace_id)).toLowerCase(),
    status: mapped.status,
    // eBay Managed Payments settles before import, so payment is always PAID.
    payment_status: ORDER_PAYMENT_STATUS.PAID,
    fulfillment_status:
      mapped.status === ORDER_STATUS.FULFILLED ? ORDER_FULFILLMENT_STATUS.COMPLETED : ORDER_FULFILLMENT_STATUS.PENDING,
    channel: ORDER_CHANNEL.EBAY,
    external_order_id: mapped.externalOrderId,
    external_buyer_username: mapped.externalBuyerUsername,
    external_raw_payload: rawEbayOrder,
    guest_access_token: generateGuestAccessToken(),
  });

  // Else eBay orders look unpaid in balance-due banners and invoice totals.
  const payment = await Payment.create({
    tenant_id: tenant._id,
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

  // Best-effort: notification failures must never fail the import.
  try {
    await notificationService.notifyNewOrder(tenant._id, order);
  } catch (err) {
    logger.error(`[order.service] failed to notify new eBay order ${order.order_number}`, { error: err.message });
  }

  return order;
}

// eBay events are per-SKU: flip status only once every item is covered.
async function updateEbayOrderStatus(externalOrderId, { sku, quantity, status }, tenantId) {
  const order = await Order.findOne({
    tenant_id: tenantId,
    channel: ORDER_CHANNEL.EBAY,
    external_order_id: externalOrderId,
  });
  if (!order) return null;

  const isFullOrderCancellation =
    order.items.length === 1 && order.items[0].sku === sku && order.items[0].quantity === quantity;
  if (!isFullOrderCancellation) {
    logger.warn(
      `[order.service] eBay order ${externalOrderId}: partial cancellation/return (${sku} x${quantity}), leaving status "${order.status}" as is for manual review`,
    );
    return order;
  }

  order.status = status;
  // RETURNED means shipped and came back, so fulfillment_status stays.
  if (status === ORDER_STATUS.CANCELLED) {
    order.fulfillment_status = ORDER_FULFILLMENT_STATUS.CANCELLED;
  }
  await order.save();
  return order;
}

// payment_status derives from payments, legacy status is derived too.
async function updateOrderStatus(orderId, { status }, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) throw httpError("Order not found", 404);

  // Restock only on the transition into cancelled, to avoid double-restocking.
  if (status === ORDER_FULFILLMENT_STATUS.CANCELLED && order.fulfillment_status !== ORDER_FULFILLMENT_STATUS.CANCELLED) {
    await syncOrderStock(order, DIRECTION.RESTOCK, { reasonPrefix: "Order cancelled" });
    // A cancelled order gives its discount use back (usage limits, per-customer).
    if (order.discount_id) await releaseOrderRedemption(order._id, tenantId);
  }

  const completesLocalDelivery =
    status === ORDER_FULFILLMENT_STATUS.COMPLETED &&
    order.fulfillment_status !== ORDER_FULFILLMENT_STATUS.COMPLETED &&
    order.delivery_method === ORDER_DELIVERY_METHOD.LOCAL_DELIVERY;

  order.fulfillment_status = status;
  order.status = deriveLegacyOrderStatus(order.fulfillment_status, order.payment_status);

  await order.save();
  if (completesLocalDelivery) await notifyLocalDeliveryCompleted(order);
  return order;
}

// Sums all succeeded Payments, a manual sale may have deposit + follow-up.
async function loadInvoiceContext(order) {
  const [totalPaidCents, totalRefundedCents, companyProfile] = await Promise.all([
    getTotalPaidForOrder(order._id),
    getTotalRefundedForOrder(order._id),
    getCompanyProfile(order.tenant_id),
  ]);
  return { totalPaidCents, totalRefundedCents, companyProfile };
}

/** Invoice PDF as the base64 attachment fields every order email takes. */
async function buildInvoiceAttachment(order, invoiceContext) {
  const orderNumber = formatOrderNumber(order.order_number_prefix, order.order_number);
  const pdfBuffer = await buildInvoicePdfBuffer(await withItemAttributes(order.toObject()), invoiceContext);
  return { orderNumber, pdfBase64: pdfBuffer.toString("base64"), pdfFilename: `${orderNumber}-invoice.pdf` };
}

// Best effort: a failed email must not undo a status change already saved.
async function notifyLocalDeliveryCompleted(order) {
  if (!order.customer.email) return;
  try {
    const invoiceContext = await loadInvoiceContext(order);
    await emailService.sendOrderDelivered({
      to: order.customer.email,
      name: order.customer.name,
      ...(await buildInvoiceAttachment(order, invoiceContext)),
      companyProfile: invoiceContext.companyProfile,
      tenantId: order.tenant_id,
    });
  } catch (err) {
    logger.error(`[order.service] failed to email delivered order ${order.order_number}`, { error: err.message });
  }
}

function safeTokenMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Bad token gives 404, not 401/403, so guessed IDs don't confirm existence.
async function getOrderForGuest(orderId, token, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId })
    .select("+guest_access_token")
    .populate("payment", "provider payment_method status card_brand card_last4 amount amount_refunded paid_at");
  if (!order || !safeTokenMatch(order.guest_access_token, token)) {
    throw httpError("Order not found", 404);
  }
  return order;
}

/** Guest payment page view: no token, plus the amount the intent will bill. */
async function getGuestOrderView(orderId, token, tenantId) {
  const order = await getOrderForGuest(orderId, token, tenantId);
  const view = order.toObject();
  delete view.guest_access_token;
  // order.payment is only the latest attempt, which an edit may have cancelled.
  return { ...view, amount_due: await getAmountDueForOrder(order) };
}

// guest_access_token is select:false, needed to build the payment link.
async function getOrderForPaymentLink(orderId, tenantId) {
  return Order.findOne({ _id: orderId, tenant_id: tenantId }).select("+guest_access_token");
}

// ── Admin ──

async function listOrders(
  { page = 1, limit = 20, skip = 0, status, channel, delivery_method, fulfillment_status, payment_status, overdue, search } = {},
  tenantId,
) {
  const filter = { tenant_id: tenantId, ...excludeAbandonedCheckouts() };
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  if (delivery_method) filter.delivery_method = delivery_method;
  if (fulfillment_status) filter.fulfillment_status = fulfillment_status;
  if (payment_status) filter.payment_status = payment_status;
  // Unpaid means still owed, so cancelled orders drop out unless asked for.
  if (UNPAID_ORDER_PAYMENT_STATUSES.includes(payment_status) && !fulfillment_status) Object.assign(filter, notCancelled());
  if (overdue) Object.assign(filter, overdueInvoices());
  if (search) {
    const tenant = await Tenant.findById(tenantId).select("order_number_prefix invoice_number_prefix").lean();
    const strippedSearch = stripOrderNumberPrefix(search, [tenant?.order_number_prefix, tenant?.invoice_number_prefix]);
    filter.$or = buildWordSearchOr(["order_number", "customer.name", "customer.email"], strippedSearch);
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

// One $facet round-trip, revenue excludes cancelled orders.
async function getOrderStats(tenantId) {
  const [result] = await Order.aggregate([
    { $match: { tenant_id: tenantId, ...excludeAbandonedCheckouts() } },
    {
      $facet: {
        revenue: [
          { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
          { $group: { _id: null, totalRevenueCents: { $sum: "$total" } } },
        ],
        pending: [
          { $match: { fulfillment_status: ORDER_FULFILLMENT_STATUS.PENDING } },
          { $count: "count" },
        ],
        unpaid: [{ $match: awaitingPayment() }, { $count: "count" }],
      },
    },
  ]);

  return {
    totalRevenueCents: result.revenue[0]?.totalRevenueCents ?? 0,
    pendingFulfillmentCount: result.pending[0]?.count ?? 0,
    unpaidCount: result.unpaid[0]?.count ?? 0,
  };
}

// Unlike getOrderForGuest, includes full payment and refund history.
async function getOrderDetailForAdmin(orderId, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) throw httpError("Order not found", 404);

  const [payments, refunds] = await Promise.all([
    getPaymentsForOrder(order._id),
    Refund.find({ order: order._id }).sort({ created_at: -1 }),
  ]);

  const { payment, ...orderFields } = await withItemAttributes(order.toObject());
  // toObject strips __v, the client sends it back with every edit.
  return { ...orderFields, version: order.__v, payments, refunds };
}

// Marks FULFILLED either way, re-send reuses on-file tracking by default.
async function sendOrderNotification(orderId, { tracking_number, carrier_name } = {}, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId }).populate("payment");
  if (!order) throw httpError("Order not found", 404);

  const invoiceContext = await loadInvoiceContext(order);
  const { totalPaidCents, companyProfile } = invoiceContext;

  // In-person sales are complete: invoice/receipt only, no shipping framing.
  if (order.channel === ORDER_CHANNEL.MANUAL) {
    if (!order.customer.email) {
      throw httpError("This customer has no email on file. Add one before sending an invoice", 400);
    }
    const amountDueCents = order.total - totalPaidCents;
    await emailService.sendManualOrderReceipt({
      to: order.customer.email,
      name: order.customer.name,
      ...(await buildInvoiceAttachment(order, invoiceContext)),
      amountDue: amountDueCents > 0 ? formatCentsAsDollars(amountDueCents) : null,
      companyProfile,
      tenantId: order.tenant_id,
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
    } else if (trimmedTracking || trimmedCarrier) {
      throw httpError("Carrier name and tracking number must be provided together", 400);
    }

    if (order.fulfillment_status !== ORDER_FULFILLMENT_STATUS.COMPLETED) {
      order.fulfillment_status = ORDER_FULFILLMENT_STATUS.COMPLETED;
      // refund recomputeLedger reads fulfillment_status before touching status.
      order.status = deriveLegacyOrderStatus(order.fulfillment_status, order.payment_status);
    }
    await order.save();
  }

  // Built after the tracking save so the invoice reflects it.
  const attachment = await buildInvoiceAttachment(order, invoiceContext);

  if (isDelivery) {
    await emailService.sendOrderShipped({
      to: order.customer.email,
      name: order.customer.name,
      ...attachment,
      trackingNumber: order.tracking_number,
      carrierName: order.carrier_name,
      companyProfile,
      tenantId: order.tenant_id,
    });
  } else {
    await emailService.sendOrderReadyForPickup({
      to: order.customer.email,
      name: order.customer.name,
      ...attachment,
      pickupLocation: companyProfile.pickup_location,
      companyProfile,
      tenantId: order.tenant_id,
    });
  }

  return order;
}

// Emails the same URL createPaymentLinkForOrder builds for staff.
async function sendPaymentLinkEmail(orderId, tenant) {
  // +guest_access_token: select:false by default, needed to build the link.
  const order = await Order.findOne({ _id: orderId, tenant_id: tenant._id }).select("+guest_access_token");
  if (!order) throw httpError("Order not found", 404);

  if (!order.customer.email) {
    throw httpError("This customer has no email on file. Add one before sending a payment link.", 400);
  }

  const { url } = createPaymentLinkForOrder(order, tenant);

  const [totalPaidCents, companyProfile] = await Promise.all([
    getTotalPaidForOrder(order._id),
    getCompanyProfile(order.tenant_id),
  ]);
  const amountDueCents = order.total - totalPaidCents;

  await emailService.sendPaymentLink({
    to: order.customer.email,
    name: order.customer.name,
    orderNumber: formatOrderNumber(order.order_number_prefix, order.order_number),
    amountDue: amountDueCents > 0 ? formatCentsAsDollars(amountDueCents) : null,
    paymentUrl: url,
    companyProfile,
    tenantId: order.tenant_id,
  });

  return { url };
}

// Separate read-only fetch: downloading skips the fulfilment side effect.
async function getInvoicePdfForOrder(orderId, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId }).populate("payment");
  if (!order) throw httpError("Order not found", 404);

  const [orderData, invoiceContext] = await Promise.all([withItemAttributes(order.toObject()), loadInvoiceContext(order)]);
  const pdfBuffer = await buildInvoicePdfBuffer(orderData, invoiceContext);

  return { pdfBuffer, orderNumber: formatOrderNumber(order.order_number_prefix, order.order_number) };
}

module.exports = {
  createOrder,
  quoteOrderDiscount,
  createManualOrder,
  recordOrderPayment,
  updateOrderCustomerDetails,
  updateOrderReferenceNumber,
  getOrderForGuest,
  getGuestOrderView,
  getOrderForPaymentLink,
  createOrderFromEbayOrder,
  updateEbayOrderStatus,
  updateOrderStatus,
  listOrders,
  getOrderStats,
  getOrderDetailForAdmin,
  sendOrderNotification,
  sendPaymentLinkEmail,
  getInvoicePdfForOrder,
  addOrderNote,
  // Shared with order-edit.service so an added line resolves like creation.
  resolveManualOrderItem,
  resolveCustomOrderItem,
};
