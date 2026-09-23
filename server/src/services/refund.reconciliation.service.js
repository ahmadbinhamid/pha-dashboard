// services/refund.reconciliation.service.js
// refund.service.js#getReservingRefunds stops counting a stale PENDING/PROCESSING refund as a
// reservation, but doesn't resolve it — this hourly sweep does. Two stuck states: "pending" is
// resumed via settleRefund again (safe to call twice); "processing" asks Stripe for the real
// state and runs it through the same handlers a webhook delivery would use.

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const refundService = require("./refund.service");
const { reconcileStripeRefund, handleChargeRefundUpdated } = require("./stripe/stripe.webhook.service");
const stripeKeysService = require("./stripe/stripe.keys.service");
const { REFUND_STATUS } = require("../constants/refund.constants");
const { PAYMENT_PROVIDER } = require("../constants/payment.constants");
const { logger } = require("../loaders/logging");

// A status: succeeded + effects_applied_at: null sweep was tried and reverted — indistinguishable
// from an old refund that predates effects_applied_at, and re-running applyRefundEffects on one
// auto-voided an otherwise-settled real refund in testing. Accepted as a residual gap.
async function reconcileStuckRefunds() {
  const cutoff = new Date(Date.now() - refundService.RESERVATION_STALE_AFTER_MS);
  const stuck = await Refund.find({
    status: { $in: [REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING] },
    created_at: { $lt: cutoff },
  });

  const summary = { checked: stuck.length, resolved: 0, stillPending: 0, errors: 0 };

  if (stuck.length === 0) {
    logger.info("[refund.reconciliation] run complete: no stuck refunds found");
    return summary;
  }

  for (const refund of stuck) {
    try {
      if (refund.status === REFUND_STATUS.PENDING) {
        await refundService.settleRefund(refund);
        summary.resolved += 1;
        continue;
      }

      // status === PROCESSING
      const order = await Order.findById(refund.order);
      const stripe = await stripeKeysService.getStripeClient(refund.tenant_id);
      let unresolved = false;

      for (const alloc of refund.payment_allocations) {
        if (alloc.provider !== PAYMENT_PROVIDER.STRIPE || alloc.settled) continue;

        try {
          const sr = await stripe.refunds.retrieve(alloc.stripe_refund_id);
          if (sr.status === "succeeded") {
            const payment = await Payment.findById(alloc.payment);
            await reconcileStripeRefund(sr, payment, order);
          } else if (sr.status === "failed" || sr.status === "canceled") {
            await handleChargeRefundUpdated(sr);
          } else {
            // Still genuinely pending at Stripe's end — checked again next sweep, not an error.
            unresolved = true;
          }
        } catch (err) {
          // Only "resource_missing" legitimately releases the reservation — a transient error
          // (500, timeout, rate limit) is not proof the refund didn't happen, so leave it PROCESSING.
          if (err.code === "resource_missing") {
            await handleChargeRefundUpdated({ status: "canceled", id: alloc.stripe_refund_id });
          } else {
            logger.warn(
              `[refund.reconciliation] transient Stripe error on ${alloc.stripe_refund_id} (refund ${refund.refund_number}): ${err.message}`,
            );
            unresolved = true;
          }
        }
      }

      if (unresolved) {
        summary.stillPending += 1;
      } else {
        summary.resolved += 1;
      }
    } catch (err) {
      summary.errors += 1;
      logger.error(`[refund.reconciliation] failed to process refund ${refund.refund_number}: ${err.message}`, {
        stack: err.stack,
      });
    }
  }

  logger.info(
    `[refund.reconciliation] run complete: checked=${summary.checked} resolved=${summary.resolved} stillPending=${summary.stillPending} errors=${summary.errors}`,
  );

  return summary;
}

module.exports = { reconcileStuckRefunds };
