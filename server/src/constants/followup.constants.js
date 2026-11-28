// constants/followup.constants.js
// Post-purchase follow-up emails and the feedback they collect.

const { ORDER_CHANNEL } = require("./order.constants");

const FOLLOW_UP_TRIGGER = Object.freeze({ ORDER_FULFILLED: "order_fulfilled" });

const FOLLOW_UP_SEND_STATUS = Object.freeze({
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
});

// eBay forbids contacting buyers off-platform, so it's never eligible.
const FOLLOW_UP_CHANNELS = Object.freeze([ORDER_CHANNEL.STOREFRONT, ORDER_CHANNEL.MANUAL]);

const FOLLOW_UP_LIMITS = Object.freeze({
  MIN_DAYS: 1,
  MAX_DAYS: 90,
  DEFAULT_SHIPPED_DAYS: 7,
  DEFAULT_HANDOVER_DAYS: 5,
  MAX_FOLLOW_UPS: 20,
  // Stop chasing orders this long after the slot passed (sweep downtime).
  MAX_LATE_DAYS: 14,
});

const RATING = Object.freeze({ MIN: 1, MAX: 5, DEFAULT_ALERT_AT: 2 });

const FEEDBACK_COMMENT_MAX = 2000;
const FOLLOW_UP_SWEEP_BATCH = 200;
const MAX_RATED_ITEMS = 10;

module.exports = {
  FOLLOW_UP_TRIGGER,
  FOLLOW_UP_SEND_STATUS,
  FOLLOW_UP_CHANNELS,
  FOLLOW_UP_LIMITS,
  RATING,
  FEEDBACK_COMMENT_MAX,
  FOLLOW_UP_SWEEP_BATCH,
  MAX_RATED_ITEMS,
};
