// services/order-edit.service.js
// Unpaid order edits (lines, prices, shipping), all through one engine.

const mongoose = require("mongoose");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const { httpError } = require("../utils/http/httpError");
const { computeOrderTotals } = require("../utils/orderTotals");
const { formatCentsAsDollars } = require("../utils/currency");
const { getTotalStockForProductVariant } = require("./inventory.service");
const { syncOrderStock, DIRECTION } = require("./order-stock-sync.service");
const { resolveManualOrderItem, resolveCustomOrderItem, getOrderDetailForAdmin } = require("./order.service");
const paymentGuard = require("./stripe/stripe.payment-guard.service");
const { ORDER_STATUS, ORDER_CHANNEL, ORDER_EDIT_CONFLICT } = require("../constants/order.constants");
const { PAYMENT_STATUS } = require("../constants/payment.constants");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

// NOTE: manual only; a storefront order is what the customer agreed to.
const EDITABLE_CHANNELS = Object.freeze([ORDER_CHANNEL.MANUAL]);
const PAID_STATUSES = Object.freeze([ORDER_STATUS.PAID, ORDER_STATUS.PARTIALLY_PAID]);
// NOTE: any money taken, even later refunded, makes an order "paid" here.
const MONEY_TAKEN_STATUSES = Object.freeze([PAYMENT_STATUS.SUCCEEDED, PAYMENT_STATUS.MANUAL_REVIEW]);

const notEditable = (message) => httpError(message, 409, { code: ORDER_EDIT_CONFLICT.NOT_EDITABLE });
const versionConflict = () =>
  httpError("This order was changed by someone else. Reload to see the latest.", 409, {
    code: ORDER_EDIT_CONFLICT.VERSION_CONFLICT,
  });

/** Why an order's lines can't be edited, or null when they can. */
async function editBlockReason(order) {
  if (order.channel === ORDER_CHANNEL.EBAY) return "eBay orders can't be edited here.";
  if (!EDITABLE_CHANNELS.includes(order.channel)) return "Online store orders can't be edited here.";
  if (PAID_STATUSES.includes(order.status)) return "Paid orders can't be edited.";
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) return "Only unpaid orders can be edited.";
  if (await Payment.exists({ order: order._id, status: { $in: MONEY_TAKEN_STATUSES } })) {
    return "Paid orders can't be edited.";
  }
  return null;
}

/** Throws the 409 when an order's lines may not be edited. */
async function assertOrderEditable(order) {
  const reason = await editBlockReason(order);
  if (reason) throw notEditable(reason);
}

// NOTE: manual deducts at creation; storefront only once paid (webhook).
function isStockDeducted(order) {
  return order.channel === ORDER_CHANNEL.MANUAL;
}

const plainItems = (order) => order.items.map((item) => item.toObject());

function findItem(items, itemId) {
  const item = items.find((i) => String(i._id) === String(itemId));
  if (!item) throw httpError("Order item not found", 404);
  return item;
}

function itemAt(items, itemIndex) {
  const item = items[itemIndex];
  if (!item) throw httpError("Order item not found", 404);
  return item;
}

// Stock lines are { item, delta }: positive deducts, negative restocks.
async function applyStockDifference(order, stockLines) {
  const lines = stockLines.filter(({ item, delta }) => item.sku && delta !== 0);
  if (!isStockDeducted(order) || !lines.length) return null;

  const toLine = ({ item, delta }) => ({ order_item_id: item._id, sku: item.sku, name: item.name, quantity: Math.abs(delta) });
  const notes = [];
  const deductions = lines.filter((l) => l.delta > 0).map(toLine);
  const restocks = lines.filter((l) => l.delta < 0).map(toLine);
  const options = { reasonPrefix: "Order edited", saleType: ADJUSTMENT_TYPE.MANUAL_SALE, refundType: ADJUSTMENT_TYPE.RESTOCK };
  if (deductions.length) {
    const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.DEDUCT, { ...options, lines: deductions });
    if (hasShortfall) notes.push(note);
  }
  if (restocks.length) await syncOrderStock(order, DIRECTION.RESTOCK, { ...options, lines: restocks });
  return notes.length ? notes.join("; ") : null;
}

// A shortfall flags the order, as creation does; it never fails the edit.
async function flagStockIssue(order, note) {
  const stock_issue_note = [order.stock_issue_note, note].filter(Boolean).join("; ");
  return Order.findOneAndUpdate(
    { _id: order._id },
    { $set: { has_stock_issue: true, stock_issue_note } },
    { new: true },
  );
}

/** Checks, build(items, order), Stripe guard, one atomic write, then stock. */
async function applyOrderEdit({ orderId, tenantId, version, user, build }) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) throw httpError("Order not found", 404);
  if (version != null && version !== order.__v) throw versionConflict();
  await assertOrderEditable(order);

  const draft = await build(plainItems(order), order);
  // NOTE: shipping stays as is; nothing records whether staff typed it in.
  const shippingCost = draft.shippingCost ?? order.shipping_cost;
  const totals = computeOrderTotals(draft.items, { shippingCost, orderDiscount: order.discount_amount });
  if (totals.total < 0) throw httpError("This change would make the order total negative", 400);

  // NOTE: Stripe first; if the write then loses, reload re-mints the intent.
  await paymentGuard.releaseOpenPaymentIntent(order);

  // Version and status in the filter make check and write one atomic step.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, tenant_id: tenantId, __v: order.__v, status: ORDER_STATUS.PENDING_PAYMENT },
    {
      $set: { items: draft.items, shipping_cost: shippingCost, ...totals },
      $inc: { __v: 1 },
      $push: { internal_notes: { text: `${draft.note} by ${user.name}`, author: user.id ?? null, created_at: new Date() } },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw versionConflict();

  const shortfall = await applyStockDifference(updated, draft.stockLines ?? []);
  return shortfall ? flagStockIssue(updated, shortfall) : updated;
}

// NOTE: as at creation, a clear shortfall is a 400; a race one only flags.
async function assertStockForIncrease(item, extra, tenantId) {
  if (!item.product || extra <= 0) return;
  const product = await Product.findOne({ _id: item.product, tenant_id: tenantId }).select("stock_control").lean();
  if (!product?.stock_control) return;
  const available = await getTotalStockForProductVariant(item.product, item.variant || null);
  if (available < extra) throw httpError(`Insufficient stock for "${item.name}" — only ${available} left`, 400);
}

// NOTE: re-adding a product bumps its line at the line's price, like the cart.
function findCatalogueLine(items, resolved) {
  const key = (i) => `${i.product}:${i.variant ?? null}`;
  return items.find((i) => !i.is_custom && i.product && key(i) === key(resolved)) ?? null;
}

/** Adds a catalogue or custom line, resolved as manual creation does. */
function addOrderItem(orderId, { version, item }, user, tenantId) {
  return applyOrderEdit({
    orderId, tenantId, version, user,
    build: async (items) => {
      const resolved = item.is_custom ? resolveCustomOrderItem(item) : await resolveManualOrderItem(item, tenantId);
      const existing = item.is_custom ? null : findCatalogueLine(items, resolved);
      if (existing) {
        const quantity = existing.quantity + resolved.quantity;
        const changed = { ...existing, quantity };
        return {
          items: items.map((i) => (i === existing ? changed : i)),
          note: `Qty of ${existing.name} changed ${existing.quantity} → ${quantity}`,
          stockLines: [{ item: changed, delta: resolved.quantity }],
        };
      }
      const added = { ...resolved, _id: new mongoose.Types.ObjectId() };
      return {
        items: [...items, added],
        note: `Added ${added.quantity} × ${added.name}`,
        stockLines: [{ item: added, delta: added.quantity }],
      };
    },
  });
}

/** Sets a line's quantity; stock moves by the difference only. */
function updateOrderItemQuantity(orderId, itemId, { version, quantity }, user, tenantId) {
  return applyOrderEdit({
    orderId, tenantId, version, user,
    build: async (items) => {
      const item = findItem(items, itemId);
      const delta = quantity - item.quantity;
      if (delta === 0) throw httpError("Quantity is unchanged", 400);
      if ((item.discount_amount || 0) > item.unit_price * quantity) {
        throw httpError(`Discount for "${item.name}" cannot exceed the line subtotal`, 400);
      }
      await assertStockForIncrease(item, delta, tenantId);
      const changed = { ...item, quantity };
      return {
        items: items.map((i) => (i === item ? changed : i)),
        note: `Qty of ${item.name} changed ${item.quantity} → ${quantity}`,
        stockLines: [{ item: changed, delta }],
      };
    },
  });
}

/** Removes a line and restocks it; the last line can't be removed. */
function removeOrderItem(orderId, itemId, { version }, user, tenantId) {
  return applyOrderEdit({
    orderId, tenantId, version, user,
    build: async (items) => {
      const item = findItem(items, itemId);
      if (items.length === 1) throw httpError("An order must keep at least one item", 400);
      return {
        items: items.filter((i) => i !== item),
        note: `Removed ${item.quantity} × ${item.name}`,
        stockLines: [{ item, delta: -item.quantity }],
      };
    },
  });
}

// NOTE: now unpaid in-store orders only; eBay and paid fixes get a 409.
function updateOrderItemPrice(orderId, itemIndex, { version, unit_price }, user, tenantId) {
  return applyOrderEdit({
    orderId, tenantId, version, user,
    build: async (items) => {
      const item = itemAt(items, itemIndex);
      if (!Number.isFinite(unit_price) || unit_price <= 0) throw httpError("Unit price must be greater than 0", 400);
      const unitPriceCents = Math.round(unit_price * 100);
      const changed = {
        ...item,
        original_unit_price: item.original_unit_price ?? item.unit_price,
        unit_price: unitPriceCents,
        unit_price_updated_at: new Date(),
        unit_price_updated_by: user.id ?? null,
      };
      return {
        items: items.map((i) => (i === item ? changed : i)),
        note: `Price of ${item.name} changed ${formatCentsAsDollars(item.unit_price)} → ${formatCentsAsDollars(unitPriceCents)}`,
      };
    },
  });
}

/** Per-line discount, checked against the line subtotal. */
function updateOrderItemDiscount(orderId, itemIndex, { version, discount_amount }, user, tenantId) {
  return applyOrderEdit({
    orderId, tenantId, version, user,
    build: async (items) => {
      const item = itemAt(items, itemIndex);
      if (!Number.isFinite(discount_amount) || discount_amount < 0) throw httpError("Discount cannot be negative", 400);
      const discountCents = Math.round(discount_amount * 100);
      if (discountCents > item.unit_price * item.quantity) throw httpError("Discount cannot exceed the line subtotal", 400);
      return {
        items: items.map((i) => (i === item ? { ...item, discount_amount: discountCents } : i)),
        note: `Discount on ${item.name} changed ${formatCentsAsDollars(item.discount_amount || 0)} → ${formatCentsAsDollars(discountCents)}`,
      };
    },
  });
}

/** Freight correction; the only path that changes shipping_cost. */
function updateOrderShippingCost(orderId, { version, shipping_cost }, user, tenantId) {
  return applyOrderEdit({
    orderId, tenantId, version, user,
    build: async (items, order) => {
      if (!Number.isFinite(shipping_cost) || shipping_cost < 0) throw httpError("Shipping cost cannot be negative", 400);
      const shippingCost = Math.round(shipping_cost * 100);
      return {
        items,
        shippingCost,
        note: `Shipping changed ${formatCentsAsDollars(order.shipping_cost)} → ${formatCentsAsDollars(shippingCost)}`,
      };
    },
  });
}

/** Admin detail plus edit_block_reason, the same check the edits enforce. */
async function getEditableOrderDetail(orderId, tenantId) {
  const detail = await getOrderDetailForAdmin(orderId, tenantId);
  return { ...detail, edit_block_reason: await editBlockReason(detail) };
}

module.exports = {
  getEditableOrderDetail,
  editBlockReason,
  assertOrderEditable,
  isStockDeducted,
  addOrderItem,
  updateOrderItemQuantity,
  removeOrderItem,
  updateOrderItemPrice,
  updateOrderItemDiscount,
  updateOrderShippingCost,
};
