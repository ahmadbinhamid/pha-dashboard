// services/stripe/stripe.cleanup.service.js
// Cancels orders that were created but never paid. Run hourly by the stripe worker's repeatable job.

const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const stripeKeysService = require("./stripe.keys.service");
const { ORDER_STATUS, ORDER_FULFILLMENT_STATUS, ORDER_CHANNEL } = require("../../constants/order.constants");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { logger } = require("../../loaders/logging");

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

async function cleanupAbandonedOrders() {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);

  const orders = await Order.find({
    status: ORDER_STATUS.PENDING_PAYMENT,
    created_at: { $lt: cutoff },
    // Only storefront orders go through Stripe checkout — a manual/eBay order at pending_payment
    // is a staff decision, not an abandoned session, and was getting silently re-cancelled. Found live.
    channel: ORDER_CHANNEL.STOREFRONT,
  });

  const summary = { checked: orders.length, cancelled: 0, skippedPaid: 0, errors: 0 };

  if (orders.length === 0) {
    logger.info("[stripe.cleanup] run complete: no abandoned orders found");
    return summary;
  }

  // Cached per run, since many abandoned orders typically belong to the same handful of tenants.
  const clientCache = new Map();
  async function getStripeClientCached(tenantId) {
    const key = String(tenantId);
    if (!clientCache.has(key)) clientCache.set(key, await stripeKeysService.getStripeClient(tenantId));
    return clientCache.get(key);
  }

  for (const order of orders) {
    try {
      const payment = await Payment.findOne({ order: order._id }).sort({ created_at: -1 });

      if (payment && payment.status === PAYMENT_STATUS.SUCCEEDED) {
        // A webhook landed but the order's own update never completed — never cancel a paid order.
        if (!payment.order_effects_applied_at) {
          logger.warn(
            `[stripe.cleanup] order ${order.order_number}: payment succeeded but order/stock effects were never completed — needs manual check (retry should self-heal via a future webhook redelivery, but Stripe's retry window is finite)`,
          );
        }
        summary.skippedPaid += 1;
        continue;
      }

      if (payment && payment.stripe_payment_intent_id) {
        const stripe = await getStripeClientCached(order.tenant_id);
        let intentStatus = null;
        try {
          const cancelled = await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
          intentStatus = cancelled.status;
        } catch (err) {
          if (err.code !== "payment_intent_unexpected_state") throw err;
          // Fetch the real status rather than guessing, since succeeded vs. canceled need opposite handling.
          const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
          intentStatus = intent.status;
        }

        if (intentStatus === "succeeded") {
          // The charge went through but our local Payment record never caught up (missed webhook).
          logger.error(
            `[stripe.cleanup] order ${order.order_number} has a succeeded PaymentIntent but local records show it unpaid — skipping cancellation, needs manual reconciliation.`,
          );
          summary.skippedPaid += 1;
          continue;
        }
        // Any other terminal status is safe to cancel the order locally below.
      }

      order.status = ORDER_STATUS.CANCELLED;
      // Keeps the split fulfillment_status field in sync (see order.service.js#sendOrderNotification).
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
