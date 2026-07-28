// scripts/backfillEbayPayments.js
//
// One-off migration: eBay orders imported before order.service.js's
// createOrderFromEbayOrder started auto-creating a Payment record have no
// Payment at all — they look unpaid everywhere that reads a Payment
// (invoice balance-due, payment history, getTotalPaid/getBalanceDue), even
// though eBay actually collected the full amount via Managed Payments
// before the order ever reached us. This backfills a Payment for every such
// order, using the exact same fields createOrderFromEbayOrder now sets for
// new imports, so old and new eBay orders end up indistinguishable.
//
// Safe to re-run: only touches Order docs with payment: null (which also
// matches "field never existed"), so an order already backfilled (or
// imported after the fix) is left alone. Also safe to re-run after a partial
// failure — reuses an existing eBay Payment for the order instead of
// creating a second one (see the Payment.findOne check below), and links it
// back via a raw Order.updateOne rather than loading + saving a full
// Mongoose document, so a legacy order missing an unrelated required field
// (e.g. invoice_number, on orders that predate that field) can't block this
// migration — same convention as migrateInvoiceNumbers.js.
//
// Usage: node scripts/backfillEbayPayments.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const { ORDER_CHANNEL } = require("../src/constants/order.constants");
const { PAYMENT_PROVIDER, PAYMENT_STATUS } = require("../src/constants/payment.constants");

async function backfill() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const orders = await Order.find({ channel: ORDER_CHANNEL.EBAY, payment: null }).lean();
  console.log(`Found ${orders.length} eBay orders with no Payment record`);

  let succeeded = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      // Reuse an already-created Payment if a prior run got this far before
      // failing on the order-side write — avoids creating a duplicate.
      let payment = await Payment.findOne({ order: order._id, provider: PAYMENT_PROVIDER.EBAY });
      if (!payment) {
        payment = await Payment.create({
          order: order._id,
          provider: PAYMENT_PROVIDER.EBAY,
          amount: order.total,
          currency: order.currency,
          status: PAYMENT_STATUS.SUCCEEDED,
          paid_at: order.created_at,
        });
      }
      await Order.updateOne({ _id: order._id }, { $set: { payment: payment._id } });
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`  Failed for order ${order.order_number} (${order._id}): ${err.message}`);
    }
  }

  console.log(`Backfilled: ${succeeded} / ${orders.length}${failed > 0 ? ` (${failed} failed)` : ""}`);

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
