// services/refund.service.js
// Order-scoped refunds; the ledger is derived state, recomputed not added.

const crypto = require("node:crypto");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const Counter = require("../models/Counter");
const Inventory = require("../models/Inventory");
const calc = require("./refund-calculator.service");
const { syncOrderStock, retryEbayPushForSku, DIRECTION } = require("./order-stock-sync.service");
const { getTotalPaidForOrder, getTotalRefundedForOrder } = require("./payment.service");
const { REFUND_STATUS, REFUND_REASON } = require("../constants/refund.constants");
const { PAYMENT_STATUS, PAYMENT_PROVIDER } = require("../constants/payment.constants");
const { ORDER_PAYMENT_STATUS, ORDER_STATUS } = require("../constants/order.constants");
const { derivePaymentStatus, deriveLegacyOrderStatus } = require("../utils/paymentStatus");
const { tenantCounterKey } = require("../utils/tenantCounterKey");
const { formatCentsAsDollars } = require("../utils/currency");
const { formatOrderNumber } = require("../utils/orderNumberFormat");
const emailService = require("./email/email.service");
const { logger } = require("../loaders/logging");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function nextRefundNumber(tenantId) {
  const counter = await Counter.findOneAndUpdate(
    { _id: tenantCounterKey(tenantId, "refund_number") },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `CN-${String(counter.seq).padStart(5, "0")}`;
}

// Stripe accepts only a few reason literals; map ours, default the rest.
function mapReasonToStripe(reason) {
  const map = {
    [REFUND_REASON.DUPLICATE_PAYMENT]: "duplicate",
    [REFUND_REASON.FRAUD_SUSPECTED]: "fraudulent",
  };
  return map[reason] || "requested_by_customer";
}

// Banks routinely reject refunds on charges older than this (Stripe won't).
const STRIPE_REFUND_WINDOW_DAYS = 180;
function isWithinStripeRefundWindow(paidAt) {
  if (!paidAt) return false;
  return Date.now() - new Date(paidAt).getTime() <= STRIPE_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// Shared ledger helpers

// Succeeded only (voided is excluded): the refunds that actually moved money.
async function getSucceededRefunds(orderId) {
  return Refund.find({ order: orderId, status: REFUND_STATUS.SUCCEEDED });
}

// Stale PENDING never reached Stripe so stops reserving; PROCESSING never.
const RESERVATION_STALE_AFTER_MS = 60 * 60 * 1000;

async function getReservingRefunds(orderId) {
  const cutoff = new Date(Date.now() - RESERVATION_STALE_AFTER_MS);
  return Refund.find({
    order: orderId,
    $or: [
      { status: { $in: [REFUND_STATUS.SUCCEEDED, REFUND_STATUS.PROCESSING] } },
      { status: REFUND_STATUS.PENDING, created_at: { $gte: cutoff } },
    ],
  });
}

function sumGst(refunds) {
  return refunds.reduce((sum, r) => sum + (r.gst_amount || 0), 0);
}

function sumShipping(refunds) {
  return refunds.reduce((sum, r) => sum + (r.shipping_amount || 0), 0);
}

function sumReservedTotal(refunds) {
  return refunds.reduce((sum, r) => sum + (r.total_amount || 0), 0);
}

// Prior line_discount per item; lineDiscount's residual check needs it.
function priorLineDiscountByItem(refunds, itemIds) {
  const map = new Map(itemIds.map((id) => [String(id), 0]));
  for (const r of refunds) {
    for (const l of r.lines) {
      const key = String(l.order_item_id);
      if (map.has(key)) map.set(key, map.get(key) + (l.line_discount || 0));
    }
  }
  return map;
}

// Qty claimed by succeeded + in-flight refunds; pass getReservingRefunds.
function reservedQuantityByItem(refunds, itemIds) {
  const map = new Map(itemIds.map((id) => [String(id), 0]));
  for (const r of refunds) {
    for (const l of r.lines) {
      const key = String(l.order_item_id);
      if (map.has(key)) map.set(key, map.get(key) + (l.quantity || 0));
    }
  }
  return map;
}

// Atomic per-order mutex; a crashed holder's lock is reclaimable after 30s.
const REFUND_LOCK_STALE_MS = 30_000;

// Jittered retries let concurrent admissions queue; 2s fits DB-only work.
const REFUND_LOCK_RETRY_BUDGET_MS = 2_000;
const REFUND_LOCK_RETRY_BASE_MS = 40;
const REFUND_LOCK_RETRY_MAX_INTERVAL_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRefundLock(orderId, tenantId) {
  const deadline = Date.now() + REFUND_LOCK_RETRY_BUDGET_MS;
  let attempt = 0;

  while (true) {
    const staleCutoff = new Date(Date.now() - REFUND_LOCK_STALE_MS);
    const token = crypto.randomUUID();
    const claimed = await Order.findOneAndUpdate(
      {
        _id: orderId,
        tenant_id: tenantId,
        $or: [{ refund_lock_at: null }, { refund_lock_at: { $lt: staleCutoff } }],
      },
      { $set: { refund_lock_at: new Date(), refund_lock_token: token } },
      { new: true },
    );
    if (claimed) return { order: claimed, token };

    if (Date.now() >= deadline) {
      // Still locked, or no such order: tell them apart so a 404 isn't a 409.
      const exists = await Order.exists({ _id: orderId, tenant_id: tenantId });
      if (!exists) throw httpError("Order not found", 404);
      throw httpError("Another refund is already in progress for this order — try again shortly", 409);
    }

    attempt += 1;
    const backoff = Math.min(REFUND_LOCK_RETRY_BASE_MS * attempt, REFUND_LOCK_RETRY_MAX_INTERVAL_MS) + Math.random() * 25;
    await sleep(backoff);
  }
}

// Fencing token: a stale holder's release must not clear a newer lock.
async function releaseRefundLock(orderId, token) {
  await Order.updateOne(
    { _id: orderId, refund_lock_token: token },
    { $set: { refund_lock_at: null, refund_lock_token: null } },
  );
}

// §2.1 GET /orders/:orderId/refundable: the server computes, UI only shows.

// §2.3 GET /orders/:orderId/refunds: lines are embedded, no populate.
async function listRefundsForOrder(orderId, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId }).select("_id");
  if (!order) throw httpError("Order not found", 404);
  return Refund.find({ order: orderId }).sort({ created_at: -1 });
}

async function getRefundableSummary(orderId, tenantId) {
  const order = await Order.findOne({ _id: orderId, tenant_id: tenantId });
  if (!order) throw httpError("Order not found", 404);

  const [payments, totalPaid, totalRefunded, reservingRefunds, stuckRefunds] = await Promise.all([
    Payment.find({ order: orderId, status: PAYMENT_STATUS.SUCCEEDED }).sort({ created_at: 1 }),
    getTotalPaidForOrder(orderId),
    getTotalRefundedForOrder(orderId), // confirmed only — for display
    getReservingRefunds(orderId),
    // Stuck >1h: PENDING already stopped reserving; PROCESSING still reserves.
    Refund.find({
      order: orderId,
      status: { $in: [REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING] },
      created_at: { $lt: new Date(Date.now() - RESERVATION_STALE_AFTER_MS) },
    }).select("refund_number status created_at total_amount"),
  ]);
  // Reserved totals, so the UI never offers what admission would reject.
  const reservedTotal = sumReservedTotal(reservingRefunds);
  const maxRefundable = Math.max(0, order.total - reservedTotal);
  const shippingAlreadyRefunded = sumShipping(reservingRefunds);
  const priorLineDiscount = priorLineDiscountByItem(reservingRefunds, order.items.map((i) => i._id));
  const reservedQty = reservedQuantityByItem(reservingRefunds, order.items.map((i) => i._id));

  const lines = order.items.map((item) => {
    const refundableQuantity = Math.max(0, item.quantity - (reservedQty.get(String(item._id)) || 0));
    const effectiveUnitPrice = item.unit_price - calc.round(item.discount_amount / item.quantity);
    return {
      order_item_id: item._id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      quantity_refunded: item.quantity_refunded, // confirmed only — see reservedQty for "available right now"
      refundable_quantity: refundableQuantity,
      unit_price: item.unit_price,
      effective_unit_price: effectiveUnitPrice,
      // Display estimate only; createRefund computes the real figure on submit.
      refundable_amount: Math.max(
        0,
        calc.lineGross(item, refundableQuantity) -
          calc.lineDiscount(item, refundableQuantity, priorLineDiscount.get(String(item._id)) || 0),
      ),
      has_inventory_record: false, // filled in below, batched
      has_ebay_listing: false,
    };
  });
  await annotateInventoryAndListingFlags(order, lines);

  const paymentsSummary = payments.map((p) => {
    const refundable = p.amount - p.amount_refunded;
    const isStripe = p.provider === PAYMENT_PROVIDER.STRIPE;
    return {
      payment_id: p._id,
      provider: p.provider,
      method: p.payment_method,
      amount: p.amount,
      amount_refunded: p.amount_refunded,
      refundable,
      ...(isStripe
        ? { stripe_refundable: refundable, stripe_window_open: isWithinStripeRefundWindow(p.paid_at) }
        : {}),
      settlement: isStripe ? "stripe" : "manual",
    };
  });

  return {
    order_total: order.total,
    total_paid: totalPaid,
    total_refunded: totalRefunded,
    max_refundable: maxRefundable,
    shipping: {
      amount: order.shipping_cost,
      refunded: shippingAlreadyRefunded,
      refundable: Math.max(0, order.shipping_cost - shippingAlreadyRefunded),
    },
    lines,
    payments: paymentsSummary,
    stuck_refunds: stuckRefunds.map((r) => ({
      refund_number: r.refund_number,
      status: r.status,
      created_at: r.created_at,
      total_amount: r.total_amount,
      // Tell apart: PENDING no longer blocks, PROCESSING still reserves.
      still_reserved: r.status === REFUND_STATUS.PROCESSING,
    })),
  };
}

// Batched (2 queries); lazy-requires listings for stores with no eBay.
async function annotateInventoryAndListingFlags(order, lines) {
  // Custom lines have no product; never let a null pair match a real doc.
  const pairs = order.items
    .filter((i) => i.product)
    .map((i) => ({ product: i.product, variant: i.variant || null }));
  if (!pairs.length) return;

  const inventoryRecords = await Inventory.find({ $or: pairs }).select("product variant").lean();
  const invSet = new Set(inventoryRecords.map((r) => `${r.product}:${r.variant || "null"}`));

  let listingSet = new Set();
  try {
    const MarketplaceListing = require("../models/MarketplaceListing");
    const { LISTING_STATE } = require("../constants/marketplace.constants");
    const listings = await MarketplaceListing.find({ $or: pairs, state: LISTING_STATE.ACTIVE })
      .select("product variant")
      .lean();
    listingSet = new Set(listings.map((r) => `${r.product}:${r.variant || "null"}`));
  } catch (err) {
    logger.warn("[refund.service] marketplace listing lookup unavailable", { error: err.message });
  }

  const itemsById = new Map(order.items.map((i) => [String(i._id), i]));
  for (const line of lines) {
    const item = itemsById.get(String(line.order_item_id));
    if (!item?.product) continue;
    const key = `${item.product}:${item.variant || "null"}`;
    line.has_inventory_record = invSet.has(key);
    line.has_ebay_listing = listingSet.has(key);
  }
}

// §2.2 POST /orders/:orderId/refunds

const REFUNDABLE_PAYMENT_STATUSES = [
  ORDER_PAYMENT_STATUS.PAID,
  ORDER_PAYMENT_STATUS.PARTIALLY_PAID,
  ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
];

async function createRefund(orderId, body, userId, tenantId) {
  const {
    idempotency_key: idempotencyKey,
    scope,
    lines: requestedLines,
    refund_shipping: refundShipping = false,
    amount,
    adjustment_amount: adjustmentAmountInput = 0,
    reason,
    internal_note: internalNote,
    payment_allocations: requestedAllocations,
    restock_all: restockAll = false,
    ebay_refund_confirmed: ebayRefundConfirmed = false,
  } = body;

  // §3.1.7: same key returns the existing refund (200); a read needs no lock.
  if (idempotencyKey) {
    const existing = await Refund.findOne({ idempotency_key: idempotencyKey, tenant_id: tenantId });
    if (existing) return existing;
  }

  // Serializes admission per order; held only until the PENDING doc exists.
  const { order, token } = await acquireRefundLock(orderId, tenantId);
  let refund;
  try {
    // §3.1.1
    if (!REFUNDABLE_PAYMENT_STATUSES.includes(order.payment_status)) {
      throw httpError(`Order payment_status "${order.payment_status}" is not refundable`, 400);
    }

    // Fail loud: in-memory item _ids exist even if the backfill never ran.
    if ((scope === "line_items" || scope === "full_order") && !order.item_ids_migrated_at) {
      throw httpError(
        "This order needs migration before item/full-invoice refunds can be issued — run scripts/backfillRefundRedesign.js",
        409,
      );
    }

    // Reserving, not succeeded: in-flight Stripe claims must count here.
    const priorRefunds = await getReservingRefunds(order._id);
    const totalRefundedSoFar = sumReservedTotal(priorRefunds);
    const maxRefundable = order.total - totalRefundedSoFar;

    let computed;
    if (scope === "amount") {
      computed = computeAmountScope({ amount, adjustmentAmountInput, maxRefundable });
    } else if (scope === "full_order") {
      computed = computeFullOrderScope({ order, priorRefunds, totalRefundedSoFar, refundShipping, restockAll, adjustmentAmountInput, requestedLines });
    } else if (scope === "line_items") {
      computed = computeLineItemsScope({ order, priorRefunds, totalRefundedSoFar, requestedLines, adjustmentAmountInput });
    } else {
      throw httpError('scope must be one of "full_order", "line_items", "amount"', 400);
    }

    // §3.1.4
    if (computed.total_amount < 1) {
      throw httpError("Discount/adjustment would make total_amount zero or negative", 400);
    }
    // §3.1.5 — absolute cap, checked LAST, after all other math. No exceptions.
    if (computed.total_amount > maxRefundable) {
      throw httpError(
        `total_amount (${formatCentsAsDollars(computed.total_amount)}) exceeds what's left refundable (${formatCentsAsDollars(maxRefundable)})`,
        400,
      );
    }

    // §3.1.6 allocations: Payment reads only, no network, so safe in the lock.
    const allocations = await resolveAllocations({ order, totalAmount: computed.total_amount, requestedAllocations });

    // eBay refunds are bookkeeping; restock needs Seller Hub acknowledgement.
    const touchesEbayPayment = allocations.some((a) => a.provider === PAYMENT_PROVIDER.EBAY);
    if (touchesEbayPayment && !ebayRefundConfirmed) {
      throw httpError(
        "This refund settles against an eBay payment — confirm the refund has already been issued in eBay Seller Hub (ebay_refund_confirmed) before continuing.",
        400,
      );
    }

    const refundNumber = await nextRefundNumber(tenantId);
    refund = await Refund.create({
      tenant_id: tenantId,
      order: order._id,
      // Legacy top-level fields for readers not yet migrated (removed in §9).
      payment: allocations[0].payment,
      amount: computed.total_amount,
      reason,
      status: REFUND_STATUS.PENDING,
      initiated_via: "admin_api",
      initiated_by: userId || null,
      // Stripe allocations settle only on webhook, never optimistically (§3.7).
      payment_allocations: allocations.map((a) => ({
        payment: a.payment,
        amount: a.amount,
        provider: a.provider,
        settled: a.provider !== PAYMENT_PROVIDER.STRIPE,
      })),
      refund_number: refundNumber,
      scope,
      lines: computed.lines,
      shipping_amount: computed.shipping_amount,
      adjustment_amount: computed.adjustment_amount,
      items_amount: computed.items_amount,
      gst_amount: computed.gst_amount,
      total_amount: computed.total_amount,
      internal_note: internalNote || null,
      idempotency_key: idempotencyKey || null,
      ebay_refund_confirmed: touchesEbayPayment ? true : false,
    });
    // Reservation is durable now, so settle outside the lock.
  } finally {
    await releaseRefundLock(orderId, token);
  }

  return settleRefund(refund);
}

// Stripe idempotency keys expire in 24h; match metadata.refund_id first.
async function findExistingStripeRefund(stripe, paymentIntentId, refundId) {
  // Auto-paginate: this refund_id may sit past the first 100 results.
  for await (const r of stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 })) {
    if (r.metadata?.refund_id === String(refundId)) return r;
  }
  return null;
}

async function settleRefund(refund) {
  const stripeAllocationIndexes = refund.payment_allocations
    .map((a, i) => (a.provider === PAYMENT_PROVIDER.STRIPE ? i : -1))
    .filter((i) => i !== -1);

  if (stripeAllocationIndexes.length > 0) {
    const stripeKeysService = require("./stripe/stripe.keys.service");
    const stripe = await stripeKeysService.getStripeClient(refund.tenant_id);

    // One batched Payment query instead of one per allocation.
    const paymentIds = stripeAllocationIndexes.map((i) => refund.payment_allocations[i].payment);
    const payments = await Payment.find({ _id: { $in: paymentIds } });
    const paymentById = new Map(payments.map((p) => [String(p._id), p]));
    const order = await Order.findById(refund.order).select("order_number order_number_prefix");

    for (const i of stripeAllocationIndexes) {
      const alloc = refund.payment_allocations[i];
      if (alloc.stripe_refund_id) continue; // sent on a prior crashed attempt; resume, never resend
      const payment = paymentById.get(String(alloc.payment));
      try {
        // Reuse a refund Stripe already holds; the idempotency key expires in 24h.
        const existing = await findExistingStripeRefund(stripe, payment.stripe_payment_intent_id, refund._id);
        if (existing) {
          refund.payment_allocations[i].stripe_refund_id = existing.id;
          continue;
        }

        const stripeRefund = await stripe.refunds.create(
          {
            payment_intent: payment.stripe_payment_intent_id,
            amount: alloc.amount,
            reason: mapReasonToStripe(refund.reason),
            metadata: {
              refund_id: String(refund._id),
              refund_number: refund.refund_number,
              order_number: order?.order_number ? formatOrderNumber(order.order_number_prefix, order.order_number) : undefined,
            },
          },
          { idempotencyKey: `refund_${refund._id.toString()}_${alloc.payment.toString()}` },
        );
        refund.payment_allocations[i].stripe_refund_id = stripeRefund.id;
      } catch (err) {
        // Earlier allocations may have settled: fail loudly, never retry silently.
        refund.status = REFUND_STATUS.FAILED;
        refund.failure_reason = err.message;
        await refund.save();
        throw httpError(
          `Stripe refund failed on allocation ${i + 1}/${stripeAllocationIndexes.length}: ${err.message}. ` +
            `Earlier allocations on this refund may have already succeeded at Stripe — review refund ${refund.refund_number} manually.`,
          502,
        );
      }
    }
    refund.status = REFUND_STATUS.PROCESSING;
    await refund.save();
    // Do NOT apply effects here — charge.refunded confirms it (§3.7/§4).
    return refund;
  }

  // Must be SUCCEEDED before effects, or its own recompute excludes it.
  refund.status = REFUND_STATUS.SUCCEEDED;
  await refund.save();
  const settled = await applyRefundEffects(refund._id);

  // applyRefundEffects voids on a ledger violation; surface that as a 409.
  if (settled.status === REFUND_STATUS.VOIDED) {
    throw httpError(
      `Refund rejected — ledger invariant violated after settlement; the attempt was voided (see refund ${settled.refund_number} for details)`,
      409,
    );
  }

  return settled;
}

// Returns the first ledger violation (qty or total over-refunded), or null.
async function findLedgerViolation(order) {
  for (const item of order.items) {
    if (item.quantity_refunded > item.quantity) {
      return `item ${item._id} quantity_refunded (${item.quantity_refunded}) exceeds quantity (${item.quantity})`;
    }
  }
  const totalRefunded = await getTotalRefundedForOrder(order._id);
  if (totalRefunded > order.total) {
    return `total refunded (${totalRefunded}) exceeds order.total (${order.total})`;
  }
  return null;
}

function computeAmountScope({ amount, adjustmentAmountInput, maxRefundable }) {
  if (!Number.isFinite(amount) || amount < 1) throw httpError("amount must be a positive integer (cents)", 400);
  const totalAmount = amount + (adjustmentAmountInput || 0);
  return {
    total_amount: totalAmount,
    items_amount: 0,
    gst_amount: calc.round(amount / calc.GST_DIVISOR),
    shipping_amount: 0,
    adjustment_amount: adjustmentAmountInput || 0,
    lines: [], // §3.5 — scope: amount never restocks, no lines at all
  };
}

function computeFullOrderScope({ order, priorRefunds, totalRefundedSoFar, refundShipping, restockAll, adjustmentAmountInput, requestedLines }) {
  if (requestedLines) throw httpError('lines must not be provided for scope: "full_order"', 400);

  // Reserved quantities, so in-flight Stripe claims are excluded too.
  const reservedQty = reservedQuantityByItem(priorRefunds, order.items.map((i) => i._id));
  const remainingItems = order.items.filter((i) => i.quantity - (reservedQty.get(String(i._id)) || 0) > 0);
  const priorLineDiscount = priorLineDiscountByItem(priorRefunds, remainingItems.map((i) => i._id));
  // Plain objects (calc adds a field); quantity_refunded is the reserved qty.
  const itemsForCalc = remainingItems.map((i) => ({
    _id: i._id,
    sku: i.sku,
    name: i.name,
    unit_price: i.unit_price,
    quantity: i.quantity,
    quantity_refunded: reservedQty.get(String(i._id)) || 0,
    discount_amount: i.discount_amount,
    priorLineDiscountRefunded: priorLineDiscount.get(String(i._id)) || 0,
  }));

  const result = calc.computeFullOrderRefund({
    order,
    items: itemsForCalc,
    priorTotalRefunded: totalRefundedSoFar,
    priorGstRefunded: sumGst(priorRefunds),
    priorShippingRefunded: sumShipping(priorRefunds),
    refundShipping: refundShipping !== false, // §3.4 — defaults true for full-invoice
  });

  const skuByItemId = new Map(itemsForCalc.map((i) => [String(i._id), i.sku]));
  return {
    total_amount: result.total_amount + (adjustmentAmountInput || 0),
    items_amount: result.items_amount,
    gst_amount: result.gst_amount,
    shipping_amount: result.shipping_amount,
    adjustment_amount: result.adjustment_amount + (adjustmentAmountInput || 0),
    lines: result.lines.map((l) => {
      const sku = skuByItemId.get(String(l.order_item_id)) ?? null;
      return {
        order_item_id: l.order_item_id,
        sku,
        name: l.name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_discount: 0,
        order_discount_share: 0,
        line_amount: l.line_amount,
        gst_amount: l.gst_amount,
        restock: !!restockAll && !!sku,
      };
    }),
  };
}

function computeLineItemsScope({ order, priorRefunds, totalRefundedSoFar, requestedLines, adjustmentAmountInput }) {
  if (!Array.isArray(requestedLines) || requestedLines.length < 1) {
    throw httpError('lines is required (min 1) for scope: "line_items"', 400);
  }
  const ids = requestedLines.map((l) => String(l.order_item_id));
  if (new Set(ids).size !== ids.length) throw httpError("lines must not contain duplicate order_item_id", 400);

  // Reserved quantities, as in computeFullOrderScope.
  const reservedQty = reservedQuantityByItem(priorRefunds, order.items.map((i) => i._id));

  const itemsById = new Map(order.items.map((i) => [String(i._id), i]));
  for (const l of requestedLines) {
    const item = itemsById.get(String(l.order_item_id));
    if (!item) throw httpError(`order_item_id ${l.order_item_id} not found on this order`, 400);
    const refundableQty = item.quantity - (reservedQty.get(String(item._id)) || 0);
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > refundableQty) {
      throw httpError(`Invalid quantity for line ${l.order_item_id} — must be between 1 and ${refundableQty}`, 400);
    }
  }

  const allLineGrossInOrder = order.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const refundLinesForApportion = requestedLines.map((l) => ({
    order_item_id: itemsById.get(String(l.order_item_id))._id,
    line_gross: calc.lineGross(itemsById.get(String(l.order_item_id)), l.quantity),
  }));
  const shares = calc.apportionOrderDiscount(order.discount_amount, refundLinesForApportion, allLineGrossInOrder);
  const priorLineDiscount = priorLineDiscountByItem(priorRefunds, requestedLines.map((l) => l.order_item_id));

  const computedLines = requestedLines.map((l) => {
    const item = itemsById.get(String(l.order_item_id));
    // Reserved qty, so the exhaustion residual goes to the right refund.
    const itemForCalc = { ...item.toObject(), quantity_refunded: reservedQty.get(String(item._id)) || 0 };
    const result = calc.computeLineItemsLine({
      item: itemForCalc,
      refundQuantity: l.quantity,
      priorLineDiscountRefunded: priorLineDiscount.get(String(l.order_item_id)) || 0,
      orderDiscountShare: shares.get(String(item._id)),
    });
    return {
      order_item_id: item._id,
      sku: item.sku,
      name: item.name,
      quantity: l.quantity,
      unit_price: item.unit_price,
      line_discount: result.line_discount,
      order_discount_share: result.order_discount_share,
      line_amount: result.line_amount,
      gst_amount: result.gst_amount,
      // §3.5: restock only when asked and the line has a SKU (never custom).
      restock: !!l.restock && !!item.sku,
    };
  });

  const naturalItemsAmount = computedLines.reduce((sum, l) => sum + l.line_amount, 0);

  // Exhausted only if qty, shipping and no manual adjustment are all covered.
  const quantitiesExhausted = order.items.every((item) => {
    const req = requestedLines.find((l) => String(l.order_item_id) === String(item._id));
    const willRefundQty = req ? req.quantity : 0;
    return (reservedQty.get(String(item._id)) || 0) + willRefundQty >= item.quantity;
  });
  const shippingCovered = order.shipping_cost === 0 || sumShipping(priorRefunds) >= order.shipping_cost;
  const noPendingAdjustment = !adjustmentAmountInput;
  const isExhausting = quantitiesExhausted && shippingCovered && noPendingAdjustment;
  const { totalAmount, adjustmentAmount } = calc.reconcileExhaustingTotal({
    naturalItemsAmount,
    shippingAmount: 0, // §3.4 — scope: line_items never touches shipping
    orderTotal: order.total,
    priorTotalRefunded: totalRefundedSoFar,
    isExhausting,
  });
  const gstAmount = calc.computeGstAmount({
    lineAmountTotal: naturalItemsAmount,
    isExhaustingOrder: isExhausting,
    orderTaxAmount: order.tax_amount,
    priorGstRefunded: sumGst(priorRefunds),
  });

  return {
    total_amount: totalAmount + (adjustmentAmountInput || 0),
    items_amount: naturalItemsAmount,
    gst_amount: gstAmount,
    shipping_amount: 0,
    adjustment_amount: adjustmentAmount + (adjustmentAmountInput || 0),
    lines: computedLines,
  };
}

// §3.1.6: allocations sum to total, each within its payment's refundable.
async function resolveAllocations({ order, totalAmount, requestedAllocations }) {
  const payments = await Payment.find({ order: order._id, status: PAYMENT_STATUS.SUCCEEDED }).sort({ created_at: 1 });
  const byId = new Map(payments.map((p) => [String(p._id), p]));

  if (requestedAllocations && requestedAllocations.length) {
    const sum = requestedAllocations.reduce((s, a) => s + a.amount, 0);
    if (sum !== totalAmount) {
      throw httpError(
        `payment_allocations must sum to total_amount (${formatCentsAsDollars(totalAmount)}), got ${formatCentsAsDollars(sum)}`,
        400,
      );
    }
    return requestedAllocations.map((a) => {
      const p = byId.get(String(a.payment_id));
      if (!p) throw httpError(`Payment ${a.payment_id} not found or not succeeded on this order`, 400);
      assertAllocationValid(p, a.amount);
      return { payment: p._id, amount: a.amount, provider: p.provider };
    });
  }

  // Auto-allocate oldest payment first, each up to its refundable amount.
  let remaining = totalAmount;
  const allocations = [];
  for (const p of payments) {
    if (remaining <= 0) break;
    const refundable = p.amount - p.amount_refunded;
    const isStripe = p.provider === PAYMENT_PROVIDER.STRIPE;
    const capacity = isStripe && !isWithinStripeRefundWindow(p.paid_at) ? 0 : refundable;
    if (capacity <= 0) continue;
    const take = Math.min(remaining, capacity);
    allocations.push({ payment: p._id, amount: take, provider: p.provider });
    remaining -= take;
  }
  if (remaining > 0) {
    throw httpError(
      `Not enough refundable payment capacity to cover ${formatCentsAsDollars(totalAmount)} (short by ${formatCentsAsDollars(remaining)}) — check whether an older payment's Stripe refund window has closed`,
      400,
    );
  }
  return allocations;
}

function assertAllocationValid(payment, amount) {
  const refundable = payment.amount - payment.amount_refunded;
  if (amount > refundable) {
    throw httpError(
      `Allocation of ${formatCentsAsDollars(amount)} exceeds payment ${payment._id}'s refundable amount (${formatCentsAsDollars(refundable)})`,
      400,
    );
  }
  if (payment.provider === PAYMENT_PROVIDER.STRIPE && !isWithinStripeRefundWindow(payment.paid_at)) {
    throw httpError(`Payment ${payment._id}'s Stripe refund window has closed — settle this allocation manually`, 400);
  }
}

// §3.7 effects: ledger recompute is idempotent; restock is guarded.
async function applyRefundEffects(refundId) {
  const refund = await Refund.findById(refundId);
  if (!refund) throw httpError("Refund not found", 404);

  const order = await Order.findById(refund.order);
  if (!order) throw httpError("Order not found for refund", 404);

  await recomputeLedger(order);

  if (refund.effects_applied_at) return refund; // restock leg already attempted

  const restockLines = refund.lines.filter((l) => l.restock && l.sku);
  if (restockLines.length > 0) {
    const { lineResults } = await syncOrderStock(order, DIRECTION.RESTOCK, {
      reasonPrefix: "Refund restock",
      lines: restockLines.map((l) => ({ order_item_id: l.order_item_id, sku: l.sku, quantity: l.quantity, name: l.name })),
      refundId: refund.refund_number,
    });

    for (const result of lineResults) {
      const line = refund.lines.find((l) => String(l.order_item_id) === String(result.order_item_id));
      if (!line) continue;
      line.ebay_sync_status = result.ebay_sync_status;
      line.ebay_sync_error = result.ebay_sync_error;
      line.restock_applied_at = new Date();
    }
  }

  refund.effects_applied_at = new Date();
  await refund.save();

  // Recompute again so quantity_restocked reflects the lines just restocked.
  await recomputeLedger(order);

  // Ledger check lives here so webhook-settled card refunds are covered too.
  const freshOrder = await Order.findById(order._id);
  const violation = await findLedgerViolation(freshOrder);
  if (violation) {
    // Settled Stripe money can't be un-refunded: flag it rather than void.
    const hasSettledStripeMoney = refund.payment_allocations.some(
      (a) => a.provider === PAYMENT_PROVIDER.STRIPE && a.settled,
    );
    if (hasSettledStripeMoney) {
      await Refund.updateOne({ _id: refund._id }, { $set: { needs_reconciliation: true } });
      logger.error(
        `[refund.service] ALERT: refund ${refund.refund_number} (order ${order._id}) violated a ledger invariant ` +
          `(${violation}) AFTER a Stripe allocation already settled — left INTACT, not auto-voided (there is no ` +
          `Stripe un-refund API; voiding here would only desync our books from what Stripe actually did). ` +
          `Needs manual reconciliation.`,
      );
      return Refund.findById(refund._id);
    }

    await voidRefund(
      refund._id,
      { reason: `Auto-voided: ${violation}`, userId: null, source: "system_auto_void" },
      refund.tenant_id,
    );
    await Refund.updateOne({ _id: refund._id }, { $set: { needs_reconciliation: true } });
    logger.error(
      `[refund.service] ALERT: refund ${refund.refund_number} (order ${order._id}) violated a ledger invariant after settlement and was auto-voided: ${violation}`,
    );
    // Reload: voidRefund saved its own copy and the flag was set separately.
    return Refund.findById(refund._id);
  }

  // Best-effort credit-note email — never let this fail the refund.
  try {
    if (order.customer?.email) {
      await emailService.sendRefundCreditNote?.({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: formatOrderNumber(order.order_number_prefix, order.order_number),
        refundNumber: refund.refund_number,
        amount: refund.total_amount,
      });
    }
  } catch (err) {
    logger.warn(`[refund.service] credit-note email failed for refund ${refund.refund_number}`, { error: err.message });
  }

  return refund;
}

// Derived-state ledger recompute; safe to call any number of times.
async function recomputeLedger(order) {
  const succeeded = await getSucceededRefunds(order._id);

  const qtyRefundedByItem = new Map();
  const qtyRestockedByItem = new Map();
  const amountByPayment = new Map();

  for (const r of succeeded) {
    for (const l of r.lines) {
      const key = String(l.order_item_id);
      qtyRefundedByItem.set(key, (qtyRefundedByItem.get(key) || 0) + l.quantity);
      if (l.restock_applied_at) {
        qtyRestockedByItem.set(key, (qtyRestockedByItem.get(key) || 0) + l.quantity);
      }
    }
    for (const a of r.payment_allocations) {
      const key = String(a.payment);
      amountByPayment.set(key, (amountByPayment.get(key) || 0) + a.amount);
    }
    // Legacy single-payment refunds have no allocations; use top-level fields.
    if (r.payment_allocations.length === 0 && r.payment) {
      const key = String(r.payment);
      amountByPayment.set(key, (amountByPayment.get(key) || 0) + r.amount);
    }
  }

  for (const item of order.items) {
    const key = String(item._id);
    item.quantity_refunded = qtyRefundedByItem.get(key) || 0;
    item.quantity_restocked = qtyRestockedByItem.get(key) || 0;
  }

  // Reset every payment first, or fully voided ones keep a stale refund total.
  const payments = await Payment.find({ order: order._id });
  await Promise.all(
    payments.map((p) => {
      const newAmount = amountByPayment.get(String(p._id)) || 0;
      if (p.amount_refunded === newAmount) return null;
      p.amount_refunded = newAmount;
      return p.save();
    }),
  );

  const totalRefunded = [...amountByPayment.values()].reduce((sum, v) => sum + v, 0);
  if (totalRefunded === 0) {
    const totalPaid = await getTotalPaidForOrder(order._id);
    order.payment_status = derivePaymentStatus(totalPaid, order.total);
  } else if (totalRefunded >= order.total) {
    order.payment_status = ORDER_PAYMENT_STATUS.REFUNDED;
  } else {
    order.payment_status = ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED;
  }
  // fulfillment_status is never touched here (§3.7 guardrail).

  // Legacy status stays derived until every consumer uses payment_status.
  order.status = deriveLegacyOrderStatus(order.fulfillment_status, order.payment_status);

  await order.save();
}

// §3.8 void / reversal

async function voidRefund(refundId, { reason: voidReason, userId, source = "admin", force = false }, tenantId) {
  const refund = await Refund.findOne({ _id: refundId, tenant_id: tenantId });
  if (!refund) throw httpError("Refund not found", 404);
  if (refund.status !== REFUND_STATUS.SUCCEEDED) {
    throw httpError(`Only a succeeded refund can be voided (current status: ${refund.status})`, 400);
  }

  // Settled Stripe money can't be reversed; only stripe_reversal or force.
  const hasSettledStripeMoney = refund.payment_allocations.some(
    (a) => a.provider === PAYMENT_PROVIDER.STRIPE && a.settled,
  );
  if (hasSettledStripeMoney && source !== "stripe_reversal" && !force) {
    throw httpError(
      `Refund ${refund.refund_number} has a Stripe allocation that already settled — voiding here would only update our books, not Stripe, leaving them permanently out of sync. Pass force: true (with a recorded reason) only if this is genuinely intended.`,
      409,
    );
  }

  const order = await Order.findById(refund.order);
  if (!order) throw httpError("Order not found for refund", 404);

  // Reverse the restock before flipping status (mirrors applyRefundEffects).
  const restockedLines = refund.lines.filter((l) => l.restock_applied_at && l.sku);
  if (restockedLines.length > 0) {
    await syncOrderStock(order, DIRECTION.DEDUCT, {
      reasonPrefix: "Refund void — re-deducting restocked units",
      lines: restockedLines.map((l) => ({ order_item_id: l.order_item_id, sku: l.sku, quantity: l.quantity, name: l.name })),
      refundId: refund.refund_number,
    });
    for (const l of restockedLines) {
      l.restock_applied_at = null; // no longer counts toward quantity_restocked
    }
  }

  refund.status = REFUND_STATUS.VOIDED;
  refund.voided_at = new Date();
  refund.voided_by = userId || null;
  refund.void_reason = voidReason || null;
  await refund.save();

  // Voided refunds leave the SUCCEEDED query, so recompute reverses them.
  await recomputeLedger(order);

  return refund;
}

// §7 retry-restock: re-runs only failed eBay pushes, never local stock.

async function retryRestockForRefund(refundId, tenantId) {
  const refund = await Refund.findOne({ _id: refundId, tenant_id: tenantId });
  if (!refund) throw httpError("Refund not found", 404);
  if (!refund.effects_applied_at) {
    throw httpError("This refund's restock leg has not been attempted yet — nothing to retry", 400);
  }

  const failedLines = refund.lines.filter((l) => l.restock && l.sku && l.ebay_sync_status === "failed");
  if (failedLines.length === 0) {
    return { refund, retried: 0 };
  }

  for (const line of failedLines) {
    const result = await retryEbayPushForSku(line.sku, tenantId);
    line.ebay_sync_status = result.ebay_sync_status;
    line.ebay_sync_error = result.ebay_sync_error;
    if (!line.restock_applied_at) line.restock_applied_at = new Date();
  }
  await refund.save();

  const order = await Order.findById(refund.order);
  if (order) await recomputeLedger(order);

  return { refund, retried: failedLines.length };
}

module.exports = {
  httpError,
  getRefundableSummary,
  listRefundsForOrder,
  createRefund,
  applyRefundEffects,
  voidRefund,
  retryRestockForRefund,
  recomputeLedger,
  nextRefundNumber,
  // Exported for refund.reconciliation.service.js.
  settleRefund,
  RESERVATION_STALE_AFTER_MS,
  // Exported for refund.service.lock.test.js to test the fencing token.
  acquireRefundLock,
  releaseRefundLock,
};
