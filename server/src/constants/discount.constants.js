// constants/discount.constants.js
// Discount types, targeting, derived status and code format.

const DISCOUNT_TYPE = Object.freeze({
  PERCENT: "percent",
  FIXED: "fixed",
  FREE_SHIPPING: "free_shipping",
});

const DISCOUNT_SCOPE = Object.freeze({ STOREWIDE: "storewide", CATEGORIES: "categories" });

// Order numbers count paid, uncancelled website orders on the email, from 1.
const MAX_ORDER_NUMBER = 100;

// Derived from active/dates/usage at read time, never stored.
const DISCOUNT_STATUS = Object.freeze({
  LIVE: "live",
  SCHEDULED: "scheduled",
  PAUSED: "paused",
  ENDED: "ended",
  EXHAUSTED: "exhausted",
});

// Codes are matched case-insensitively and stored upper-case.
const PROMO_CODE_PATTERN = /^[A-Z0-9._-]{3,24}$/;

const MAX_PERCENT_OFF = 90;

const RECENT_REDEMPTIONS_LIMIT = 50;

module.exports = {
  DISCOUNT_TYPE,
  DISCOUNT_SCOPE,
  MAX_ORDER_NUMBER,
  DISCOUNT_STATUS,
  PROMO_CODE_PATTERN,
  MAX_PERCENT_OFF,
  RECENT_REDEMPTIONS_LIMIT,
};
