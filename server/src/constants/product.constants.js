// constants/product.constants.js

const PRODUCT_TYPE = Object.freeze({
  PHYSICAL: 1,
  DIGITAL: 2,
});

const PRODUCT_STATUS = Object.freeze({
  DRAFT: 0,
  ACTIVE: 1,
});

const EBAY_SYNC_STATUS = Object.freeze({
  NOT_LISTED: "not_listed",
  PENDING: "pending",
  SYNCED: "synced",
  ERROR: "error",
});

module.exports = { PRODUCT_TYPE, PRODUCT_STATUS, EBAY_SYNC_STATUS };
