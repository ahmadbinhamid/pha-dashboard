// services/stripe/stripe.cleanup.service.js
//
// Cancels orders that were created but never paid. Run hourly by the stripe
// worker's repeatable job — see src/workers/stripe.worker.js.

const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const { getStripeClient } = require("./stripe.client.service");
const { ORDER_STATUS } = require("../../constants/order.constants");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { logger } = require("../../loaders/logging");

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

// Errors Stripe returns when the intent is already in a terminal state —
// nothing left for us to cancel, so treat these as a no-op rather than a
// failure of this run.
function isAlreadyFinalized(err) {
  return (
    err.code === "payment_intent_unexpected_state" ||
    /already been captured|already succeeded|already canceled/i.test(err.message || "")
  );
}

async function cleanupAbandonedOrders() {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);

  const orders = await Order.find({
    status: ORDER_STATUS.PENDING_PAYMENT,
    created_at: { $lt: cutoff },
  });

  const summary = { checked: orders.length, cancelled: 0, skippedPaid: 0, errors: 0 };

  if (orders.length === 0) {
    logger.info("[stripe.cleanup] run complete: no abandoned orders found");
    return summary;
  }

  const stripe = getStripeClient();

  for (const order of orders) {
    try {
      const payment = await Payment.findOne({ order: order._id }).sort({ created_at: -1 });

      if (payment && payment.status === PAYMENT_STATUS.SUCCEEDED) {
        // A webhook landed but this order's status update hasn't (or won't,
        // because it's not actually pending) — never cancel a paid order.
        summary.skippedPaid += 1;
        continue;
      }

      if (payment && payment.stripe_payment_intent_id) {
        try {
          const cancelled = await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
          if (cancelled.status === "succeeded") {
            // Paid right as we were cancelling it — leave it for the
            // payment_intent.succeeded webhook to mark the order paid.
            summary.skippedPaid += 1;
            continue;
          }
        } catch (err) {
          if (!isAlreadyFinalized(err)) throw err;
        }
      }

      order.status = ORDER_STATUS.CANCELLED;
      await order.save();
      summary.cancelled += 1;
    } catch (err) {
      summary.errors += 1;
      logger.error(`[stripe.cleanup] failed to process order ${order.order_number}: ${err.message}`, {
        stack: err.stack,
      });
    }
  }

  logger.info(
    `[stripe.cleanup] run complete: checked=${summary.checked} cancelled=${summary.cancelled} skippedPaid=${summary.skippedPaid} errors=${summary.errors}`,
  );

  return summary;
}

module.exports = { cleanupAbandonedOrders };
