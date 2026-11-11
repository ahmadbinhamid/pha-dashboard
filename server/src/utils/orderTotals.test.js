// utils/orderTotals.test.js
// AU GST at 10%: extracted from inclusive prices, freight GST included.

const test = require("node:test");
const assert = require("node:assert/strict");
const { computeOrderTotals, splitOrderGst, GST_LABEL } = require("./orderTotals");

const item = (unit_price, quantity = 1, discount_amount = 0) => ({ unit_price, quantity, discount_amount });

test("labels the rate as 10%", () => {
  assert.equal(GST_LABEL, "GST (10%)");
});

test("$110 item with no freight is $10 GST", () => {
  assert.deepEqual(computeOrderTotals([item(11000)]), {
    subtotal: 11000, tax_amount: 1000, gst_includes_shipping: true, total: 11000,
  });
});

test("$110 item plus $11 freight is $11 GST on a $121 total", () => {
  const totals = computeOrderTotals([item(11000)], { shippingCost: 1100 });
  assert.equal(totals.tax_amount, 1100);
  assert.equal(totals.total, 12100);
});

test("new order split: ex-GST subtotal, ex-GST freight and GST add to total", () => {
  const order = { ...computeOrderTotals([item(11000)], { shippingCost: 1100 }), shipping_cost: 1100 };
  const { totalGst, freightGst, itemsGst } = splitOrderGst(order);
  assert.deepEqual({ totalGst, freightGst, itemsGst }, { totalGst: 1100, freightGst: 100, itemsGst: 1000 });
  const exSubtotal = order.subtotal - itemsGst;
  const exFreight = order.shipping_cost - freightGst;
  assert.equal(exSubtotal + exFreight + totalGst, order.total);
});

test("legacy order keeps its stored GST and shows no freight GST", () => {
  const legacy = { subtotal: 11000, shipping_cost: 1100, tax_amount: 1000, total: 12100 };
  assert.deepEqual(splitOrderGst(legacy), { totalGst: 1000, freightGst: 0, itemsGst: 1000 });
});
