// services/refund-calculator.service.test.js
//
// Run with: node --test src/services/refund-calculator.service.test.js
// (or `node --test src` to run every *.test.js in the tree).
//
// This is the money-math file — refund-redesign-spec.md §9 explicitly calls
// out "effective line amount across all four discount/price-edit
// combinations" and "GST drift across three uneven partials on a
// non-divisible total" as required unit tests. Covered below, plus the two
// rounding-drift bugs found and fixed during this work (§3.2/§3.3 point 3).

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  lineGross,
  lineDiscount,
  apportionOrderDiscount,
  computeGstAmount,
  computeLineItemsLine,
  computeShippingRefund,
  computeFullOrderRefund,
  reconcileExhaustingTotal,
  assertNonNegative,
} = require("./refund-calculator.service");

// ── lineGross ────────────────────────────────────────────────────────────

test("lineGross: unit_price * refundQuantity, not the full line", () => {
  assert.equal(lineGross({ unit_price: 1000 }, 2), 2000);
  assert.equal(lineGross({ unit_price: 999 }, 1), 999);
});

// ── lineDiscount — proportional (non-exhausting) ────────────────────────

test("lineDiscount: proportional share when not exhausting the line", () => {
  const item = { discount_amount: 300, quantity: 3, quantity_refunded: 0 };
  // refunding 1 of 3 — not exhausting (0 + 1 < 3)
  assert.equal(lineDiscount(item, 1, 0), 100);
});

test("lineDiscount: price-edited line — discount is independent of unit_price", () => {
  // §3.2 point 3 of the edge matrix / §9's price-edit test: original_unit_price
  // is irrelevant here since lineDiscount never reads unit_price at all —
  // refund.service.js is responsible for always passing item.unit_price
  // (current) into lineGross, never original_unit_price. This test exists to
  // document that lineDiscount itself has no price coupling to get wrong.
  const item = { discount_amount: 500, quantity: 2, quantity_refunded: 0 };
  assert.equal(lineDiscount(item, 1, 0), 250);
});

// ── lineDiscount — exhaustion-residual rounding fix (a) ─────────────────

test("lineDiscount: three separate 1-of-3 refunds sum to exactly the discount (not 99/100)", () => {
  // This is the exact bug found during Phase 0(c): round(100/3) three times
  // is 33+33+33=99, one cent short. The exhaustion-residual fix must close it.
  const item = { discount_amount: 100, quantity: 3, quantity_refunded: 0 };

  const first = lineDiscount(item, 1, 0);
  item.quantity_refunded += 1;
  const second = lineDiscount(item, 1, first);
  item.quantity_refunded += 1;
  const third = lineDiscount(item, 1, first + second); // this refund exhausts (2+1>=3)

  assert.equal(first + second + third, 100);
  // The final (exhausting) refund is the one that absorbed the residual —
  // not necessarily equal to a naive round(100/3).
  assert.equal(third, 100 - first - second);
});

test("lineDiscount: 2-of-3 then 1-of-3 also reconciles exactly", () => {
  const item = { discount_amount: 100, quantity: 3, quantity_refunded: 0 };
  const first = lineDiscount(item, 2, 0); // round(200/3)=67, not exhausting (0+2<3)
  item.quantity_refunded += 2;
  const second = lineDiscount(item, 1, first); // exhausts (2+1>=3) — exact residual
  assert.equal(first + second, 100);
});

test("lineDiscount: refuses to go negative if priorLineDiscountRefunded overshoots (bad input guard)", () => {
  const item = { discount_amount: 100, quantity: 2, quantity_refunded: 1 };
  assert.throws(() => lineDiscount(item, 1, 150), /negative/);
});

// ── apportionOrderDiscount — largest-remainder rounding fix (b) ─────────

test("apportionOrderDiscount: reproduces the exact Phase-0(c) one-cent bug and confirms the fix", () => {
  // Same constructed order as the Phase 0(c) verification: three lines,
  // gross $30.00/$7.77/$6.66, order.discount_amount = $1.37 (137 cents).
  // Naive independent rounding gave 93+24+21=138, one cent over the true
  // 137 — largest-remainder must sum to exactly 137.
  const refundLines = [
    { order_item_id: "a", line_gross: 3000 },
    { order_item_id: "b", line_gross: 777 },
    { order_item_id: "c", line_gross: 666 },
  ];
  const allLineGrossInOrder = 3000 + 777 + 666; // 4443 — full order gross, all lines at full qty

  const shares = apportionOrderDiscount(137, refundLines, allLineGrossInOrder);

  const total = [...shares.values()].reduce((sum, v) => sum + v, 0);
  assert.equal(total, 137, "shares must sum to exactly the order discount, not 138");
  assert.equal(shares.size, 3);
});

test("apportionOrderDiscount: deterministic regardless of input array order (tie-break on order_item_id)", () => {
  const linesA = [
    { order_item_id: "z-line", line_gross: 500 },
    { order_item_id: "a-line", line_gross: 500 },
  ];
  const linesB = [linesA[1], linesA[0]]; // reversed
  const gross = 1000;

  const sharesA = apportionOrderDiscount(101, linesA, gross); // odd total forces a tie-break
  const sharesB = apportionOrderDiscount(101, linesB, gross);

  assert.deepEqual([...sharesA.entries()].sort(), [...sharesB.entries()].sort());
  // "a-line" should win the tie (alphabetically first) per the documented
  // tiebreak rule.
  assert.ok(sharesA.get("a-line") >= sharesA.get("z-line"));
});

test("apportionOrderDiscount: zero discount short-circuits to all-zero shares", () => {
  const lines = [{ order_item_id: "a", line_gross: 100 }, { order_item_id: "b", line_gross: 200 }];
  const shares = apportionOrderDiscount(0, lines, 300);
  assert.equal(shares.get("a"), 0);
  assert.equal(shares.get("b"), 0);
});

// ── computeGstAmount — exhaustion-residual (§3.3) ───────────────────────

test("computeGstAmount: proportional when not exhausting", () => {
  assert.equal(
    computeGstAmount({ lineAmountTotal: 1100, isExhaustingOrder: false, orderTaxAmount: 999, priorGstRefunded: 0 }),
    100,
  );
});

test("computeGstAmount: exact residual when exhausting, regardless of lineAmountTotal", () => {
  const gst = computeGstAmount({
    lineAmountTotal: 99999, // deliberately irrelevant — must be ignored when exhausting
    isExhaustingOrder: true,
    orderTaxAmount: 1000,
    priorGstRefunded: 663,
  });
  assert.equal(gst, 337);
});

// ── computeLineItemsLine — full pipeline + non-negative guard ───────────

test("computeLineItemsLine: composes gross, discount, and order share correctly", () => {
  const item = { unit_price: 1000, quantity: 2, quantity_refunded: 0, discount_amount: 100 };
  const result = computeLineItemsLine({
    item,
    refundQuantity: 1,
    priorLineDiscountRefunded: 0,
    orderDiscountShare: 20,
  });
  // gross = 1000, discount = round(100*1/2)=50, orderShare = 20
  assert.equal(result.line_gross, 1000);
  assert.equal(result.line_discount, 50);
  assert.equal(result.order_discount_share, 20);
  assert.equal(result.line_amount, 1000 - 50 - 20);
  assert.equal(result.gst_amount, Math.round(result.line_amount / 11));
});

test("computeLineItemsLine: throws rather than clamps when order share would push line_amount negative", () => {
  const item = { unit_price: 100, quantity: 1, quantity_refunded: 0, discount_amount: 0 };
  assert.throws(
    () => computeLineItemsLine({ item, refundQuantity: 1, priorLineDiscountRefunded: 0, orderDiscountShare: 200 }),
    /negative/,
  );
});

// ── computeShippingRefund (§3.4) ─────────────────────────────────────────

test("computeShippingRefund: only ever a concept for scope full_order with refundShipping true", () => {
  const base = { shippingCost: 1500, shippingAlreadyRefunded: 0 };
  assert.equal(computeShippingRefund({ scope: "line_items", refundShipping: true, ...base }), 0);
  assert.equal(computeShippingRefund({ scope: "amount", refundShipping: true, ...base }), 0);
  assert.equal(computeShippingRefund({ scope: "full_order", refundShipping: false, ...base }), 0);
  assert.equal(computeShippingRefund({ scope: "full_order", refundShipping: true, ...base }), 1500);
});

test("computeShippingRefund: cumulative cap — can't refund shipping twice", () => {
  const result = computeShippingRefund({
    scope: "full_order",
    refundShipping: true,
    shippingCost: 1500,
    shippingAlreadyRefunded: 1500,
  });
  assert.equal(result, 0);
});

// ── computeFullOrderRefund — rounding fix (c): no apportionment, exact plug ─

test("computeFullOrderRefund: total is the exact remaining balance, adjustment_amount absorbs the order discount", () => {
  const order = { total: 4623, tax_amount: 387, shipping_cost: 500 };
  const items = [
    { _id: "a", sku: "A", name: "Item A", unit_price: 1000, quantity: 3, quantity_refunded: 0, discount_amount: 150, priorLineDiscountRefunded: 0 },
    { _id: "b", sku: "B", name: "Item B", unit_price: 777, quantity: 1, quantity_refunded: 0, discount_amount: 0, priorLineDiscountRefunded: 0 },
    { _id: "c", sku: "C", name: "Item C", unit_price: 333, quantity: 2, quantity_refunded: 0, discount_amount: 33, priorLineDiscountRefunded: 0 },
  ];

  const result = computeFullOrderRefund({
    order,
    items,
    priorTotalRefunded: 0,
    priorGstRefunded: 0,
    priorShippingRefunded: 0,
    refundShipping: true,
  });

  assert.equal(result.total_amount, 4623);
  assert.equal(result.shipping_amount, 500);
  assert.equal(result.gst_amount, 387);
  // Reconciles exactly by construction — items + shipping + adjustment === total.
  assert.equal(result.items_amount + result.shipping_amount + result.adjustment_amount, result.total_amount);
  assert.equal(result.lines.length, 3);
});

test("computeFullOrderRefund: second (final) full-order refund on top of a prior partial takes the exact remainder", () => {
  const order = { total: 10000, tax_amount: 909, shipping_cost: 0 };
  const items = [
    { _id: "a", sku: "A", name: "Item A", unit_price: 5000, quantity: 2, quantity_refunded: 1, discount_amount: 0, priorLineDiscountRefunded: 0 },
  ];
  const result = computeFullOrderRefund({
    order,
    items,
    priorTotalRefunded: 5000, // one unit already refunded earlier
    priorGstRefunded: 455,
    priorShippingRefunded: 0,
    refundShipping: false,
  });
  assert.equal(result.total_amount, 5000);
  assert.equal(result.gst_amount, 909 - 455);
});

// ── §9's required invariant test — four uneven partial refunds exhaust an
// order exactly, on a fixture designed to maximize rounding pressure:
// subtotal not divisible by 11, odd discounts on BOTH layers, three lines
// with uneven quantities. ─────────────────────────────────────────────────

test("invariant: a sequence of partial refunds that exhausts an order sums exactly to order.total and order.tax_amount", () => {
  // Fixture, built the same way order.service.js would compute it:
  const items = [
    { _id: "a", unit_price: 1301, quantity: 5, discount_amount: 137, quantity_refunded: 0 }, // odd unit price & discount
    { _id: "b", unit_price: 733, quantity: 3, discount_amount: 51, quantity_refunded: 0 },
    { _id: "c", unit_price: 2999, quantity: 2, discount_amount: 89, quantity_refunded: 0 },
  ];
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity - i.discount_amount, 0);
  const orderDiscountAmount = 173; // odd order-level discount too
  const shippingCost = 0;
  const total = subtotal - orderDiscountAmount + shippingCost;
  const taxAmount = Math.round(subtotal / 11); // deliberately NOT evenly divisible by 11
  assert.notEqual(subtotal % 11, 0, "fixture sanity check: subtotal must not be divisible by 11");

  const allLineGrossInOrder = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // Ledger state, mutated as we go — mirrors what refund.service.js would
  // track across the Refund collection in reality.
  const priorLineDiscountRefundedById = new Map(items.map((i) => [i._id, 0]));
  let priorTotalRefunded = 0;
  let priorGstRefunded = 0;
  const refunds = [];

  function refundPartial(lines) {
    // lines: [{ item, refundQuantity }]
    const refundLines = lines.map(({ item, refundQuantity }) => ({
      order_item_id: item._id,
      line_gross: lineGross(item, refundQuantity),
    }));
    const shares = apportionOrderDiscount(orderDiscountAmount, refundLines, allLineGrossInOrder);

    const computed = lines.map(({ item, refundQuantity }) =>
      computeLineItemsLine({
        item,
        refundQuantity,
        priorLineDiscountRefunded: priorLineDiscountRefundedById.get(item._id),
        orderDiscountShare: shares.get(item._id),
      }),
    );

    const naturalItemsAmount = computed.reduce((sum, c) => sum + c.line_amount, 0);
    // Exact-quantity signal, NOT a dollar comparison — see
    // reconcileExhaustingTotal's own comment for why a dollar-based check is
    // wrong here (it's exactly the bug this fixture caught).
    const isExhausting = items.every((i) => {
      const thisPassQty = lines.find((l) => l.item === i)?.refundQuantity || 0;
      return i.quantity_refunded + thisPassQty >= i.quantity;
    });
    // Generalized fix (a) — see reconcileExhaustingTotal's own comment: the
    // transaction that exhausts the order's whole remaining balance takes
    // the exact residual, regardless of whether it was literally requested
    // as scope: full_order.
    const { totalAmount } = reconcileExhaustingTotal({
      naturalItemsAmount,
      shippingAmount: 0,
      orderTotal: total,
      priorTotalRefunded,
      isExhausting,
    });
    const gstAmount = computeGstAmount({
      lineAmountTotal: naturalItemsAmount,
      isExhaustingOrder: isExhausting,
      orderTaxAmount: taxAmount,
      priorGstRefunded,
    });

    // Update ledger state for the next pass.
    lines.forEach(({ item, refundQuantity }, idx) => {
      item.quantity_refunded += refundQuantity;
      priorLineDiscountRefundedById.set(item._id, priorLineDiscountRefundedById.get(item._id) + computed[idx].line_discount);
    });
    priorTotalRefunded += totalAmount;
    priorGstRefunded += gstAmount;

    refunds.push({ total_amount: totalAmount, gst_amount: gstAmount });
  }

  // Four uneven passes exhausting all three lines' quantities (5+3+2=10 units total).
  refundPartial([{ item: items[0], refundQuantity: 2 }]); // a: 2 of 5
  refundPartial([{ item: items[1], refundQuantity: 1 }, { item: items[2], refundQuantity: 1 }]); // b:1, c:1
  refundPartial([{ item: items[0], refundQuantity: 3 }]); // a: remaining 3 of 5 — exhausts a
  refundPartial([{ item: items[1], refundQuantity: 2 }, { item: items[2], refundQuantity: 1 }]); // b, c — exhausts both

  const sumTotalAmount = refunds.reduce((sum, r) => sum + r.total_amount, 0);
  const sumGstAmount = refunds.reduce((sum, r) => sum + r.gst_amount, 0);

  assert.equal(sumTotalAmount, total, "sum of all refunds.total_amount must equal order.total exactly");
  assert.equal(sumGstAmount, taxAmount, "sum of all refunds.gst_amount must equal order.tax_amount exactly");
  items.forEach((i) => assert.equal(i.quantity_refunded, i.quantity, "every line must be fully exhausted"));
});

// ── assertNonNegative ─────────────────────────────────────────────────────

test("assertNonNegative: passes through non-negative values, throws on negative", () => {
  assert.equal(assertNonNegative(0, "x"), 0);
  assert.equal(assertNonNegative(5, "x"), 5);
  assert.throws(() => assertNonNegative(-1, "x"), /negative/);
});
