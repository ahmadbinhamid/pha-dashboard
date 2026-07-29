// services/refund.service.js
//
// refund-redesign-spec.md §3. Order-scoped, not payment-scoped — a refund is
// driven by what the customer returns, not which card paid (§0's "core
// reframe"). One Refund entity with a `scope` and a settlement adapter
// chosen by each allocation's own payment.provider, not six hand-written
// scope × method code paths.
//
// No Mongo transaction anywhere (standalone mongod — see the revised §3.7 in
// the spec doc for the full reasoning). Every ledger field this file writes
// (order.items[i].quantity_refunded/quantity_restocked, payment.amount_refunded,
// order.payment_status) is DERIVED STATE: recomputed from the Refund
// collection and assigned absolutely, never incremented. That's what makes
// applyRefundEffects safe to call from anywhere, any number of times —
// initial settlement, webhook redelivery, a stuck-refund sweep — with no
// transaction needed to make it crash-safe.

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
const { derivePaymentStatus } = require("../utils/paymentStatus");
const emailService = require("./email/email.service");
const { logger } = require("../loaders/logging");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function nextRefundNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "refund_number" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `CN-${String(counter.seq).padStart(5, "0")}`;
}

// Stripe's refund `reason` only accepts a few literal values distinct from
// ours; map what we can, default the rest — same mapping stripe.refund.service.js
// used, kept here since that file is being retired in favour of this one.
function mapReasonToStripe(reason) {
  const map = {
    [REFUND_REASON.DUPLICATE_PAYMENT]: "duplicate",
    [REFUND_REASON.FRAUD_SUSPECTED]: "fraudulent",
  };
  return map[reason] || "requested_by_customer";
}

// Practical Stripe/card-network refund window — Stripe's API doesn't hard-
// enforce this itself, but issuing banks routinely reject a refund request
// on a charge this old. §2.1's stripe_window_open / §3.1.6's allocation cap.
const STRIPE_REFUND_WINDOW_DAYS = 180;
function isWithinStripeRefundWindow(paidAt) {
  if (!paidAt) return false;
  return Date.now() - new Date(paidAt).getTime() <= STRIPE_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// ── Shared ledger helpers — one query, reused by every derivation below ───

// {order:1, status:1} index (§1.3) — every succeeded, non-voided refund on
// the order. A voided refund's status is "voided", not "succeeded", so it's
// naturally excluded here without any separate "subtract it back out" logic.
async function getSucceededRefunds(orderId) {
  return Refund.find({ order: orderId, status: REFUND_STATUS.SUCCEEDED });
}

function sumGst(refunds) {
  return refunds.reduce((sum, r) => sum + (r.gst_amount || 0), 0);
}

function sumShipping(refunds) {
  return refunds.reduce((sum, r) => sum + (r.shipping_amount || 0), 0);
}

// This item's own cumulative line_discount already recorded across every
// prior succeeded refund touching it — refund-calculator.service.js#lineDiscount's
// exhaustion-residual check needs this, and it can't be reconstructed from
// line_amount alone (that also nets out order_discount_share).
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

// ── §2.1 GET /orders/:orderId/refundable — server tells the UI what's
// possible, the UI computes nothing. ────────────────────────────────────

// §2.3 GET /orders/:orderId/refunds — history, lines already populated
// (embedded, not a ref — no populate() needed).
async function listRefundsForOrder(orderId) {
  const order = await Order.findById(orderId).select("_id");
  if (!order) throw httpError("Order not found", 404);
  return Refund.find({ order: orderId }).sort({ created_at: -1 });
}

async function getRefundableSummary(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw httpError("Order not found", 404);

  const [payments, totalPaid, totalRefunded, priorRefunds] = await Promise.all([
    Payment.find({ order: orderId, status: PAYMENT_STATUS.SUCCEEDED }).sort({ created_at: 1 }),
    getTotalPaidForOrder(orderId),
    getTotalRefundedForOrder(orderId),
    getSucceededRefunds(orderId),
  ]);
  const maxRefundable = Math.max(0, order.total - totalRefunded);
  const shippingAlreadyRefunded = sumShipping(priorRefunds);
  const priorLineDiscount = priorLineDiscountByItem(priorRefunds, order.items.map((i) => i._id));

  const lines = order.items.map((item) => {
    const refundableQuantity = item.quantity - item.quantity_refunded;
    const effectiveUnitPrice = item.unit_price - calc.round(item.discount_amount / item.quantity);
    return {
      order_item_id: item._id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      quantity_refunded: item.quantity_refunded,
      refundable_quantity: refundableQuantity,
      unit_price: item.unit_price,
      effective_unit_price: effectiveUnitPrice,
      // Display estimate only — the authoritative figure comes from
      // POST /orders/:orderId/refunds' own computation at submit time.
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
  };
}

// Batched (2 queries total, not per-line) — §2.1's has_inventory_record /
// has_ebay_listing let the UI disable/warn on the restock checkbox instead
// of silently no-oping. Lazy-requires MarketplaceListing/its constants,
// matching inventory.service.js#fanOutMarketplaceInventory's own reasoning
// (avoid a hard dependency on that module graph for stores with no eBay).
async function annotateInventoryAndListingFlags(order, lines) {
  const pairs = order.items.map((i) => ({ product: i.product, variant: i.variant || null }));
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
    if (!item) continue;
    const key = `${item.product}:${item.variant || "null"}`;
    line.has_inventory_record = invSet.has(key);
    line.has_ebay_listing = listingSet.has(key);
  }
}

// ── §2.2 POST /orders/:orderId/refunds ──────────────────────────────────

const REFUNDABLE_PAYMENT_STATUSES = [
  ORDER_PAYMENT_STATUS.PAID,
  ORDER_PAYMENT_STATUS.PARTIALLY_PAID,
  ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
];

async function createRefund(orderId, body, userId) {
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
  } = body;

  // §3.1.7 — return the existing refund, 200 not 409, on a genuine
  // concurrent double-submit with the same client-generated key.
  if (idempotencyKey) {
    const existing = await Refund.findOne({ idempotency_key: idempotencyKey });
    if (existing) return existing;
  }

  const order = await Order.findById(orderId);
  if (!order) throw httpError("Order not found", 404);

  // §3.1.1
  if (!REFUNDABLE_PAYMENT_STATUSES.includes(order.payment_status)) {
    throw httpError(`Order payment_status "${order.payment_status}" is not refundable`, 400);
  }

  // Corrections round, condition 2(a) — fail loud per-order, never assume
  // the §6.2 backfill ran. item._id's mere presence can't be trusted (see
  // Order.js's item_ids_migrated_at comment: Mongoose auto-generates one in
  // memory on every hydrate, persisted or not).
  if ((scope === "line_items" || scope === "full_order") && !order.item_ids_migrated_at) {
    throw httpError(
      "This order needs migration before item/full-invoice refunds can be issued — run scripts/backfillRefundRedesign.js",
      409,
    );
  }

  const [totalRefundedSoFar, priorRefunds] = await Promise.all([
    getTotalRefundedForOrder(order._id),
    getSucceededRefunds(order._id),
  ]);
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
    throw httpError(`total_amount (${computed.total_amount}) exceeds what's left refundable (${maxRefundable})`, 400);
  }

  // §3.1.6 — allocations
  const allocations = await resolveAllocations({ order, totalAmount: computed.total_amount, requestedAllocations });

  const refundNumber = await nextRefundNumber();
  const refund = await Refund.create({
    order: order._id,
    // Legacy top-level fields, kept populated so any not-yet-migrated reader
    // still sees something sane during the transition (§9 removes them).
    payment: allocations[0].payment,
    amount: computed.total_amount,
    reason,
    status: REFUND_STATUS.PENDING,
    initiated_via: "admin_api",
    initiated_by: userId || null,
    // settled defaults true (schema) but MUST start false for a Stripe
    // allocation — §3.7's "do NOT apply effects optimistically" means even
    // a successful stripe.refunds.create() call below doesn't count as
    // settled, only the charge.refunded/charge.refund.updated webhook does.
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
  });

  const stripeAllocationIndexes = refund.payment_allocations
    .map((a, i) => (a.provider === PAYMENT_PROVIDER.STRIPE ? i : -1))
    .filter((i) => i !== -1);

  if (stripeAllocationIndexes.length > 0) {
    const { getStripeClient } = require("./stripe/stripe.client.service");
    const stripe = getStripeClient();
    for (const i of stripeAllocationIndexes) {
      const alloc = refund.payment_allocations[i];
      const payment = await Payment.findById(alloc.payment);
      try {
        const stripeRefund = await stripe.refunds.create(
          {
            payment_intent: payment.stripe_payment_intent_id,
            amount: alloc.amount,
            reason: mapReasonToStripe(reason),
            metadata: { refund_id: String(refund._id), refund_number: refundNumber, order_number: order.order_number },
          },
          { idempotencyKey: `refund_${refund._id.toString()}_${alloc.payment.toString()}` },
        );
        refund.payment_allocations[i].stripe_refund_id = stripeRefund.id;
      } catch (err) {
        // §3.1's guardrail on partial failure: earlier allocations in this
        // loop may have already succeeded at Stripe. Mark failed and surface
        // exactly which allocations settled rather than silently retrying.
        refund.status = REFUND_STATUS.FAILED;
        refund.failure_reason = err.message;
        await refund.save();
        throw httpError(
          `Stripe refund failed on allocation ${i + 1}/${stripeAllocationIndexes.length}: ${err.message}. ` +
            `Earlier allocations on this refund may have already succeeded at Stripe — review refund ${refundNumber} manually.`,
          502,
        );
      }
    }
    refund.status = REFUND_STATUS.PROCESSING;
    await refund.save();
    // Do NOT apply effects here — charge.refunded confirms it (§3.7/§4).
  } else {
    refund.status = REFUND_STATUS.SUCCEEDED;
    await refund.save();
    // applyRefundEffects loads and mutates its OWN copy of this document —
    // return that one, not this now-stale in-memory `refund`, so the API
    // response (and the idempotency-hit path above) reflect the actually-
    // settled state (effects_applied_at, ebay_sync_status, etc.) rather than
    // a pre-effects snapshot.
    return applyRefundEffects(refund._id);
  }

  return refund;
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

  const remainingItems = order.items.filter((i) => i.quantity - i.quantity_refunded > 0);
  const priorLineDiscount = priorLineDiscountByItem(priorRefunds, remainingItems.map((i) => i._id));
  // Plain objects, not the live Mongoose subdocuments — computeFullOrderRefund
  // only reads a handful of fields and needs the extra
  // priorLineDiscountRefunded one bolted on, which a Mongoose subdocument
  // (a strict schema instance) won't accept an arbitrary property onto.
  const itemsForCalc = remainingItems.map((i) => ({
    _id: i._id,
    sku: i.sku,
    name: i.name,
    unit_price: i.unit_price,
    quantity: i.quantity,
    quantity_refunded: i.quantity_refunded,
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

  const itemsById = new Map(order.items.map((i) => [String(i._id), i]));
  for (const l of requestedLines) {
    const item = itemsById.get(String(l.order_item_id));
    if (!item) throw httpError(`order_item_id ${l.order_item_id} not found on this order`, 400);
    const refundableQty = item.quantity - item.quantity_refunded;
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
    const result = calc.computeLineItemsLine({
      item,
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
      // §3.5 — restock is driven solely by the submitted boolean, never
      // inferred from reason or fullness. A line with no sku can't restock
      // regardless of what was requested.
      restock: !!l.restock && !!item.sku,
    };
  });

  const naturalItemsAmount = computedLines.reduce((sum, l) => sum + l.line_amount, 0);
  // Exact-quantity signal (not a dollar comparison — see
  // reconcileExhaustingTotal's own comment for why that's wrong).
  const isExhausting = order.items.every((item) => {
    const req = requestedLines.find((l) => String(l.order_item_id) === String(item._id));
    const willRefundQty = req ? req.quantity : 0;
    return item.quantity_refunded + willRefundQty >= item.quantity;
  });
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

// §3.1.6 — sum(allocations.amount) === total_amount; each <= payment's own
// refundable; each Stripe allocation <= stripe_refundable and within the
// refund window; every referenced payment succeeded.
async function resolveAllocations({ order, totalAmount, requestedAllocations }) {
  const payments = await Payment.find({ order: order._id, status: PAYMENT_STATUS.SUCCEEDED }).sort({ created_at: 1 });
  const byId = new Map(payments.map((p) => [String(p._id), p]));

  if (requestedAllocations && requestedAllocations.length) {
    const sum = requestedAllocations.reduce((s, a) => s + a.amount, 0);
    if (sum !== totalAmount) {
      throw httpError(`payment_allocations must sum to total_amount (${totalAmount}), got ${sum}`, 400);
    }
    return requestedAllocations.map((a) => {
      const p = byId.get(String(a.payment_id));
      if (!p) throw httpError(`Payment ${a.payment_id} not found or not succeeded on this order`, 400);
      assertAllocationValid(p, a.amount);
      return { payment: p._id, amount: a.amount, provider: p.provider };
    });
  }

  // Auto-allocate: oldest payment first (deposit before a later top-up),
  // filling each up to its own refundable capacity.
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
      `Not enough refundable payment capacity to cover ${totalAmount} (short by ${remaining}) — check whether an older payment's Stripe refund window has closed`,
      400,
    );
  }
  return allocations;
}

function assertAllocationValid(payment, amount) {
  const refundable = payment.amount - payment.amount_refunded;
  if (amount > refundable) {
    throw httpError(`Allocation of ${amount} exceeds payment ${payment._id}'s refundable amount (${refundable})`, 400);
  }
  if (payment.provider === PAYMENT_PROVIDER.STRIPE && !isWithinStripeRefundWindow(payment.paid_at)) {
    throw httpError(`Payment ${payment._id}'s Stripe refund window has closed — settle this allocation manually`, 400);
  }
}

// ── §3.7 — settlement effect application ────────────────────────────────
//
// Two parts, two different safety properties:
//   (a) ledger recompute — unconditional, no guard needed (derived state,
//       idempotent by construction).
//   (b) restock + eBay — guarded by effects_applied_at, since THIS is a real
//       side effect (stock adjustment, live eBay push), not derived state.
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

  // Ledger recompute again — this time quantity_restocked reflects the
  // restock_applied_at values just set above. Cheap (one indexed query),
  // idempotent — no reason to hand-maintain a narrower update path.
  await recomputeLedger(order);

  // Best-effort credit-note email — never let this fail the refund.
  try {
    if (order.customer?.email) {
      await emailService.sendRefundCreditNote?.({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: order.order_number,
        refundNumber: refund.refund_number,
        amount: refund.total_amount,
      });
    }
  } catch (err) {
    logger.warn(`[refund.service] credit-note email failed for refund ${refund.refund_number}`, { error: err.message });
  }

  return refund;
}

// The derived-state recompute itself — see the revised §3.7 in the spec doc.
// Always safe to call, any number of times, from any caller.
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
    // Legacy single-payment shape (scope: amount refunds created before this
    // rewrite, or the deprecated shim path) — payment_allocations may be
    // empty on those; fall back to the top-level payment/amount fields so
    // they still count toward the recompute.
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

  // Payments MUST be reset before computing payment_status below — ALL of
  // the order's payments, not just the ones appearing in amountByPayment
  // right now (a payment that had every one of its refunds voided needs
  // resetting back to 0, not skipping). Found live: voiding every refund on
  // a fully-paid manual order left its Payment stuck at a stale non-zero
  // amount_refunded, which then made getTotalPaidForOrder (below) undercount
  // and recompute the order as partially_paid instead of paid — that read
  // was happening before this write ever landed.
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

  // Legacy `status` (§1.2/§9) — kept in sync here as a DERIVED value, not
  // independently set, until every consumer (order list/badges/dashboard/
  // invoice PDF — ~20 files across BE+FE) migrates to payment_status/
  // fulfillment_status directly. Without this, `status` would silently go
  // stale after any refund: nothing else in this rewrite touches the legacy
  // field, so every existing reader of `order.status` would keep showing
  // pre-refund state forever. Preserves the exact intent of the original
  // Phase 0 bug fix — a fulfilled order's status doesn't get wrongly
  // reverted just because a refund's ledger recompute ran — while still
  // surfacing a genuine refund state when one legitimately applies. This is
  // the one piece of §9 NOT fully done (see the final report): the other 19
  // files still read `status` directly rather than the split fields, and a
  // blind rename across order creation, eBay/Stripe webhooks, dashboard
  // aggregation, and 9 frontend views — none of which I can visually verify
  // — is a materially different risk than this single, contained,
  // always-consistent derivation.
  if (
    order.fulfillment_status === "fulfilled" &&
    order.payment_status !== ORDER_PAYMENT_STATUS.REFUNDED &&
    order.payment_status !== ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED
  ) {
    order.status = ORDER_STATUS.FULFILLED;
  } else if (order.fulfillment_status === "cancelled") {
    order.status = ORDER_STATUS.CANCELLED;
  } else {
    order.status = order.payment_status;
  }

  await order.save();
}

// ── §3.8 void / reversal ─────────────────────────────────────────────────

async function voidRefund(refundId, { reason: voidReason, userId }) {
  const refund = await Refund.findById(refundId);
  if (!refund) throw httpError("Refund not found", 404);
  if (refund.status !== REFUND_STATUS.SUCCEEDED) {
    throw httpError(`Only a succeeded refund can be voided (current status: ${refund.status})`, 400);
  }

  const order = await Order.findById(refund.order);
  if (!order) throw httpError("Order not found for refund", 404);

  // Reverse the restock BEFORE flipping status — re-deduct stock for any
  // line that was actually restocked, and push the lowered quantity to
  // eBay. A real side effect, stays explicit (mirrors applyRefundEffects'
  // own restock leg).
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

  // Excluded from the {status: SUCCEEDED} query now — recompute naturally
  // reverses everything applyRefundEffects did, no decrement logic needed.
  await recomputeLedger(order);

  return refund;
}

// ── §7 POST /refunds/:id/retry-restock — re-runs ONLY the eBay leg for
// lines whose push previously failed. Never re-touches local stock (already
// correctly adjusted) or already-synced lines. ──────────────────────────

async function retryRestockForRefund(refundId) {
  const refund = await Refund.findById(refundId);
  if (!refund) throw httpError("Refund not found", 404);
  if (!refund.effects_applied_at) {
    throw httpError("This refund's restock leg has not been attempted yet — nothing to retry", 400);
  }

  const failedLines = refund.lines.filter((l) => l.restock && l.sku && l.ebay_sync_status === "failed");
  if (failedLines.length === 0) {
    return { refund, retried: 0 };
  }

  for (const line of failedLines) {
    const result = await retryEbayPushForSku(line.sku);
    line.ebay_sync_status = result.ebay_sync_status;
    line.ebay_sync_error = result.ebay_sync_error;
    if (!line.restock_applied_at) line.restock_applied_at = new Date();
  }
  await refund.save();

  const order = await Order.findById(refund.order);
  if (order) await recomputeLedger(order);

  return { refund, retried: failedLines.length };
}

// createLegacyPaymentRefund removed (refund-redesign-spec.md §9) — the
// /payment/:id/refund and /payment/:id/refund-manual shims it backed are
// gone; POST /order/:orderId/refunds (createRefund below) is the only path now.

module.exports = {
  httpError,
  getRefundableSummary,
  listRefundsForOrder,
  createRefund,
  applyRefundEffects,
  voidRefund,
  retryRestockForRefund,
  // Exported for stripe.webhook.service.js (§4/§6) and tests.
  isWithinStripeRefundWindow,
  recomputeLedger,
  nextRefundNumber,
};
