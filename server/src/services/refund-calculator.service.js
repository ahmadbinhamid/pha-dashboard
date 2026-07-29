// services/refund-calculator.service.js
//
// refund-redesign-spec.md §3.2–§3.4. Pure math only — no DB access, no
// Mongoose, no side effects — so this is the one file unit tests can
// exercise directly. refund.service.js (§3.1, §3.7) owns everything
// DB-shaped (loading the order/payments, writing the Refund doc, calling
// Stripe); this owns "given these numbers, what does the customer get back
// and how is it split." This is deliberately the most heavily-tested file in
// the whole feature — per the user's own framing, this is where the money
// bugs live.
//
// Rounding-drift corrections (approved deviation from the spec's original
// single-round-per-line text — see refund-redesign-spec.md §3.2/§3.3 and the
// conversation history for the full reasoning, summarized here):
//
//   (a) ACROSS separate refunds of the SAME line/order over time: naively
//       re-deriving a proportional share on every partial refund does not
//       guarantee the pieces sum back to the true total — three separate
//       1-of-3-unit refunds of a $1.00 line discount each round to $0.33,
//       summing to $0.99, one cent short. Fix: when a refund EXHAUSTS the
//       line's remaining quantity (or the order's remaining refundable
//       balance, for GST), take the exact residual (total minus whatever
//       was already recorded against prior refunds) instead of an
//       independently-rounded proportional share.
//   (b) WITHIN one refund, apportioning order.discount_amount across
//       multiple lines in the SAME request: independently rounding each
//       line's share has the identical problem. Fix: largest-remainder
//       apportionment — floor every line's exact share, then hand the
//       leftover whole cents one at a time to the lines with the largest
//       fractional remainder, tie-breaking on order_item_id for a
//       deterministic result independent of array order.
//   (c) scope: full_order never apportions order.discount_amount across
//       lines at all — see computeFullOrderRefund. The whole remaining
//       balance is taken directly as the total (order.total minus whatever
//       has already been refunded), and whatever isn't attributable to a
//       specific line (the order-level discount, plus any residual rounding)
//       is captured once as the refund's own `adjustment_amount`, not spread
//       across lines. This is exact by construction — there is nothing to
//       round-trip.

const GST_DIVISOR = 11; // AU GST-inclusive convention — see order.service.js#GST_DIVISOR

function round(n) {
  return Math.round(n);
}

// Point 3's guard: a computed amount must never be pushed below zero —
// throw rather than silently clamp, since clamping would either hide a real
// bug in the inputs or silently under/over-refund.
function assertNonNegative(value, label) {
  if (value < 0) {
    const err = new Error(`refund-calculator: computed ${label} is negative (${value}) — refusing to clamp`);
    err.status = 500;
    throw err;
  }
  return value;
}

// §3.2 — a line's gross contribution for the quantity being refunded right
// now. Deliberately NOT item.unit_price * item.quantity unless
// refundQuantity === item.quantity — refund against unit_price (what was
// actually charged, possibly edited after the order was placed), never
// original_unit_price (see §3.2's price-edit note; refund.service.js is
// responsible for reading item.unit_price, this function just multiplies).
function lineGross(item, refundQuantity) {
  return item.unit_price * refundQuantity;
}

// §3.2 + rounding fix (a) — item.discount_amount apportioned by
// refundQuantity/item.quantity, exact residual when this refund exhausts the
// line's remaining quantity. priorLineDiscountRefunded is this item's own
// cumulative line discount already recorded across every prior succeeded
// (non-voided) refund touching it — refund.service.js supplies this from the
// Refund collection; this function does no DB reads itself.
function lineDiscount(item, refundQuantity, priorLineDiscountRefunded) {
  const isExhausting = item.quantity_refunded + refundQuantity >= item.quantity;
  if (isExhausting) {
    return assertNonNegative(item.discount_amount - priorLineDiscountRefunded, "line_discount residual");
  }
  return round((item.discount_amount * refundQuantity) / item.quantity);
}

// §3.2 + rounding fix (b) — largest-remainder apportionment of
// order.discount_amount across every line in ONE refund request (not the
// whole order — only scope: line_items ever calls this; scope: full_order
// uses computeFullOrderRefund instead, per fix (c)).
//
// refundLines: [{ order_item_id, line_gross }] for just the lines in this
// refund. allLineGrossInOrder: sum of unit_price * quantity across EVERY
// item on the order at full (not remaining) quantity — order.discount_amount
// was set against the whole order's original gross, not against whatever
// happens to still be refundable today.
//
// Returns Map<order_item_id (string), shareCents> — every entry sums to
// exactly Math.round(the lines' combined exact share), never independently
// drifted per line.
function apportionOrderDiscount(orderDiscountAmount, refundLines, allLineGrossInOrder) {
  if (orderDiscountAmount === 0 || refundLines.length === 0) {
    return new Map(refundLines.map((l) => [String(l.order_item_id), 0]));
  }
  if (allLineGrossInOrder <= 0) {
    throw Object.assign(new Error("refund-calculator: allLineGrossInOrder must be positive"), { status: 500 });
  }

  const withExact = refundLines.map((l) => ({
    order_item_id: String(l.order_item_id),
    exact: (orderDiscountAmount * l.line_gross) / allLineGrossInOrder,
  }));
  const withFloor = withExact.map((s) => ({ ...s, floor: Math.floor(s.exact) }));

  const totalFloored = withFloor.reduce((sum, s) => sum + s.floor, 0);
  const totalExact = withExact.reduce((sum, s) => sum + s.exact, 0);
  const remainderCents = round(totalExact) - totalFloored;

  // Largest fractional remainder first; order_item_id as a deterministic
  // tiebreak so the result never depends on array order (spec's explicit
  // requirement for point 3b).
  const sorted = [...withFloor].sort((a, b) => {
    const fracA = a.exact - a.floor;
    const fracB = b.exact - b.floor;
    if (fracB !== fracA) return fracB - fracA;
    return a.order_item_id < b.order_item_id ? -1 : a.order_item_id > b.order_item_id ? 1 : 0;
  });
  const bonusIds = new Set(sorted.slice(0, Math.max(0, remainderCents)).map((s) => s.order_item_id));

  const result = new Map();
  for (const s of withFloor) {
    result.set(s.order_item_id, s.floor + (bonusIds.has(s.order_item_id) ? 1 : 0));
  }
  return result;
}

// §3.3 + rounding fix (a) — same exhaustion-residual principle as
// lineDiscount, applied to GST at the ORDER level (order.tax_amount is only
// ever an order-level figure — there's no per-line GST ledger to exhaust
// against, only the order's total).
function computeGstAmount({ lineAmountTotal, isExhaustingOrder, orderTaxAmount, priorGstRefunded }) {
  if (isExhaustingOrder) {
    return assertNonNegative(orderTaxAmount - priorGstRefunded, "gst_amount residual");
  }
  return round(lineAmountTotal / GST_DIVISOR);
}

// §3.2 full pipeline for ONE line within a scope: "line_items" refund.
// orderDiscountShare comes from apportionOrderDiscount, computed once for
// every line in the request together (never per-line in isolation, or fix
// (b) doesn't hold).
function computeLineItemsLine({ item, refundQuantity, priorLineDiscountRefunded, orderDiscountShare }) {
  const gross = lineGross(item, refundQuantity);
  const discount = lineDiscount(item, refundQuantity, priorLineDiscountRefunded);
  const lineAmount = assertNonNegative(gross - discount - orderDiscountShare, "line_amount");
  const gstAmount = round(lineAmount / GST_DIVISOR);
  return { line_gross: gross, line_discount: discount, order_discount_share: orderDiscountShare, line_amount: lineAmount, gst_amount: gstAmount };
}

// Rounding fix (a), generalized beyond the literal scope: full_order case —
// found while writing the §9 invariant test, not in the original approved
// text, so flagging loudly: fix (b)'s largest-remainder apportionment only
// guarantees the shares WITHIN one refund sum correctly. It says nothing
// about the *cumulative* order_discount_share across several separate
// scope: line_items refunds over time — the same class of drift lineDiscount
// and GST needed an exhaustion-residual fix for. A real admin refunding
// units back one return at a time (never explicitly choosing "full order"
// scope) can still end up being the transaction that happens to exhaust the
// order's entire remaining balance — this is not just a test artifact.
//
// ANY refund, regardless of scope, that exhausts the order's remaining
// refundable balance takes the exact residual as its total_amount. The gap
// between what line-by-line math naturally produced and that residual
// (pure rounding dust, at most a few cents) is absorbed into
// adjustment_amount — every refund already carries that field regardless of
// scope, so this needs no new schema surface.
//
// `isExhausting` MUST be supplied by the caller, computed from exact integer
// QUANTITIES (every line's cumulative quantity_refunded, after this refund,
// reaching its quantity) — never inferred by comparing this function's own
// naturalItemsAmount to the remaining dollar balance. That comparison looks
// reasonable but is wrong: naturalItemsAmount is itself the output of
// rounded per-line math, so on the fixture that motivated this whole fix,
// the true final/exhausting refund's naturally-computed total landed one
// cent BELOW the remaining balance — a dollar-amount comparison concluded
// "not exhausting yet" one refund too early, masking the very drift this
// function exists to correct. Quantities are exact integers with no
// rounding ambiguity; they're the only reliable signal for this.
function reconcileExhaustingTotal({ naturalItemsAmount, shippingAmount, orderTotal, priorTotalRefunded, isExhausting }) {
  const naturalTotal = naturalItemsAmount + shippingAmount;
  if (!isExhausting) {
    return { totalAmount: naturalTotal, adjustmentAmount: 0, isExhausting: false };
  }
  const totalAmount = assertNonNegative(orderTotal - priorTotalRefunded, "remaining order balance");
  const adjustmentAmount = totalAmount - naturalTotal;
  return { totalAmount, adjustmentAmount, isExhausting: true };
}

// §3.4 — shipping is refundable once, cumulatively capped across every
// refund on the order, and only ever a concept for scope: full_order (§3.4:
// "refunding one of three items does not mean you did not ship" — scope:
// line_items never touches shipping at all).
function computeShippingRefund({ scope, refundShipping, shippingCost, shippingAlreadyRefunded }) {
  if (scope !== "full_order" || !refundShipping) return 0;
  return assertNonNegative(shippingCost - shippingAlreadyRefunded, "shipping_amount");
}

// §3.2/§3.3 rounding fix (c) — scope: full_order never apportions
// order.discount_amount across lines. The whole remaining balance is taken
// directly; whatever isn't attributable to a specific line becomes the
// refund's own adjustment_amount (already a signed, order-level field on the
// Refund schema — exactly what it's for), not spread across lines. Exact by
// construction: nothing here is rounded against an approximation of
// something else, so there is no drift to correct.
//
// items: every order item with refundable_quantity > 0 (refund.service.js
// filters this — this function just consumes what it's given).
function computeFullOrderRefund({ order, items, priorTotalRefunded, priorGstRefunded, priorShippingRefunded, refundShipping, adjustmentAmount = 0 }) {
  const totalAmount = assertNonNegative(order.total - priorTotalRefunded + adjustmentAmount, "total_amount");
  const shippingAmount = computeShippingRefund({
    scope: "full_order",
    refundShipping,
    shippingCost: order.shipping_cost,
    shippingAlreadyRefunded: priorShippingRefunded,
  });
  const gstAmount = computeGstAmount({
    lineAmountTotal: 0, // unused — full_order always exhausts
    isExhaustingOrder: true,
    orderTaxAmount: order.tax_amount,
    priorGstRefunded,
  });

  // Per-item lines for the credit note, item-level discount only — no
  // order-level apportionment (that's exactly what fix (c) says not to do
  // for this scope). refundQuantity is always the item's own full remaining
  // quantity here (there's no partial-quantity concept for a full-order
  // refund), which always satisfies lineDiscount's exhaustion check, so this
  // always takes the exact residual rather than a proportional share — each
  // item.priorLineDiscountRefunded is this item's own cumulative line
  // discount already recorded across prior succeeded refunds, supplied by
  // the caller exactly like computeLineItemsLine expects.
  const lines = items.map((item) => {
    const refundQuantity = item.quantity - item.quantity_refunded;
    const gross = lineGross(item, refundQuantity);
    const discount = lineDiscount(item, refundQuantity, item.priorLineDiscountRefunded || 0);
    const lineAmount = assertNonNegative(gross - discount, "line_amount");
    return {
      order_item_id: item._id,
      sku: item.sku,
      name: item.name,
      quantity: refundQuantity,
      unit_price: item.unit_price,
      line_amount: lineAmount,
      gst_amount: round(lineAmount / GST_DIVISOR),
    };
  });

  const itemsAmount = lines.reduce((sum, l) => sum + l.line_amount, 0);
  // Everything not attributed to a specific line (the order-level discount,
  // primarily) — defined as the exact plug so the total always reconciles,
  // never independently re-derived and risking drift.
  const derivedAdjustment = totalAmount - itemsAmount - shippingAmount;

  return {
    total_amount: totalAmount,
    items_amount: itemsAmount,
    shipping_amount: shippingAmount,
    gst_amount: gstAmount,
    adjustment_amount: derivedAdjustment,
    lines,
  };
}

module.exports = {
  GST_DIVISOR,
  round,
  assertNonNegative,
  lineGross,
  lineDiscount,
  apportionOrderDiscount,
  computeGstAmount,
  computeLineItemsLine,
  computeShippingRefund,
  computeFullOrderRefund,
  reconcileExhaustingTotal,
};
