// services/stripe/stripe.cleanup.service.js
//
// Cancels orders that were created but never paid. Run hourly by the stripe
// worker's repeatable job — see src/workers/stripe.worker.js.

const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const { getStripeClient } = require("./stripe.client.service");
const { ORDER_STATUS, ORDER_FULFILLMENT_STATUS } = require("../../constants/order.constants");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { logger } = require("../../loaders/logging");

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

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
        let intentStatus = null;
        try {
          const cancelled = await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
          intentStatus = cancelled.status;
        } catch (err) {
          if (err.code !== "payment_intent_unexpected_state") throw err;
          // Cancel was rejected because the intent is already in a terminal
          // state — fetch the real status rather than guessing from the
          // error text, since "already succeeded" and "already canceled"
          // require opposite handling below.
          const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
          intentStatus = intent.status;
        }

        if (intentStatus === "succeeded") {
          // The charge actually went through but our local Payment record
          // never caught up (e.g. a missed webhook). Never cancel a paid
          // order — flag it for manual reconciliation instead.
          logger.error(
            `[stripe.cleanup] order ${order.order_number} has a succeeded PaymentIntent but local records show it unpaid — skipping cancellation, needs manual reconciliation.`,
          );
          summary.skippedPaid += 1;
          continue;
        }
        // Any other terminal status (already canceled, etc.) — safe to
        // cancel the order locally below.
      }

      order.status = ORDER_STATUS.CANCELLED;
      // Keeps the new split field (§1.2) in sync — see the matching comment
      // in order.service.js#sendOrderNotification for why this matters.
      order.fulfillment_status = ORDER_FULFILLMENT_STATUS.CANCELLED;
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
