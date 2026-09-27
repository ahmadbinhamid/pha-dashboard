// constants/inventory.constants.js

const ADJUSTMENT_TYPE = Object.freeze({
  RESTOCK: "restock",
  DAMAGED: "damaged",
  LOST: "lost",
  STOLEN: "stolen",
  CORRECTION: "correction",
  TRANSFER_IN: "transfer_in",
  TRANSFER_OUT: "transfer_out",
  EBAY_SALE: "ebay_sale",
  EBAY_MANUAL_ADJUSTMENT: "ebay_manual_adjustment",
  STRIPE_SALE: "stripe_sale",
  STRIPE_REFUND: "stripe_refund",
  MANUAL_SALE: "manual_sale",
  OTHER: "other",
});

// Low-stock digest cadence; weekly/monthly send on one day at send time.
const DIGEST_FREQUENCY = Object.freeze({ DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly" });
// Capped at 28 so a monthly digest fires in every month, February included.
const DIGEST_MONTH_DAY_MAX = 28;
// Single-market app: schedule days are Sydney days (matches the FE).
const DIGEST_TIMEZONE = "Australia/Sydney";

module.exports = { ADJUSTMENT_TYPE, DIGEST_FREQUENCY, DIGEST_MONTH_DAY_MAX, DIGEST_TIMEZONE };
