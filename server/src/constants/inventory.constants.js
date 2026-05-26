// constants/inventory.constants.js

const ADJUSTMENT_TYPE = Object.freeze({
  RESTOCK: "restock",
  DAMAGED: "damaged",
  LOST: "lost",
  STOLEN: "stolen",
  CORRECTION: "correction",
  TRANSFER_IN: "transfer_in",
  TRANSFER_OUT: "transfer_out",
  OTHER: "other",
});

module.exports = { ADJUSTMENT_TYPE };
