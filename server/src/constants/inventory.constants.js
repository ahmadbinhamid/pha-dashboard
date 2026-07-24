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

module.exports = { ADJUSTMENT_TYPE };
