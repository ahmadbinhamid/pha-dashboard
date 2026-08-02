// services/refund.reconciliation.service.js
//
// Corrections round — refund.service.js#getReservingRefunds stops counting a
// PENDING/PROCESSING refund as an admission-time reservation once it's older
// than RESERVATION_STALE_AFTER_MS (necessary so a dropped webhook or a
// crashed request can't lock out further refunds on an order forever), but
// that bound only stops it silently reserving quantity/money — it does
// nothing to actually resolve the stuck refund itself. This sweep is what
// does that: run periodically (hourly, via the stripe worker's repeatable
// job — see src/workers/stripe.worker.js) rather than waiting for someone to
// notice getRefundableSummary's `stuck_refunds` list.
//
// Two distinct stuck states, two different fixes:
//   - status: pending — never made it into/through settleRefund (crashed
//     between Refund.create() and the Stripe calls, or partway through a
//     multi-allocation loop). Resumed by calling settleRefund again, which
//     is safe to call more than once: it skips any allocation that already
//     has a stripe_refund_id, so a crash mid-loop can't double-refund.
//   - status: processing — every Stripe allocation already has a
//     stripe_refund_id (settleRefund only reaches "processing" once every
//     allocation's Stripe call succeeded); the charge.refunded/
//     charge.refund.updated webhook confirming it just never arrived. Ask
//     Stripe directly for the real state instead of waiting indefinitely,
//     and run it through the exact same handlers a webhook delivery would
//     have used — reconcileStripeRefund for succeeded/still-pending,
//     handleChargeRefundUpdated for failed/canceled — rather than
//     duplicating either's logic here.

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const refundService = require("./refund.service");
const { reconcileStripeRefund, handleChargeRefundUpdated } = require("./stripe/stripe.webhook.service");
const stripeKeysService = require("./stripe/stripe.keys.service");
const { REFUND_STATUS } = require("../constants/refund.constants");
const { PAYMENT_PROVIDER } = require("../constants/payment.constants");
const { logger } = require("../loaders/logging");

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
            // Still genuinely pending at Stripe's end — nothing to do yet,
            // this allocation stays unsettled and will be checked again
            // next sweep. Not an error, just not resolved this round.
            unresolved = true;
          }
        } catch (err) {
          // Only "the refund genuinely doesn't exist at Stripe" is a real
          // answer that legitimately releases the reservation — everything
          // else (a transient 500, a timeout, a rate limit) is Stripe being
          // temporarily unreachable, NOT proof the refund didn't happen.
          // PROCESSING has no age bound (see getReservingRefunds) precisely
          // because "we couldn't confirm it" must never be treated the same
          // as "it didn't happen" — misreading a transient error as
          // resource_missing would release a reservation for money that's
          // actually still moving at Stripe. Leave it PROCESSING and retry
          // next sweep for anything but a confirmed resource_missing.
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
