// constants/product.constants.js

const PRODUCT_TYPE = Object.freeze({
  PHYSICAL: "physical",
  DIGITAL: "digital",
});

const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
});

const PRODUCT_CONDITION = Object.freeze({
  NEW: "NEW",
  USED: "USED",
});

const PRODUCT_AUTHENTICITY = Object.freeze({
  GENUINE: "Genuine",
  AFTERMARKET: "Aftermarket",
});

const PRODUCT_SORT = Object.freeze({
  PRICE_LOW_HIGH: "price_low_high",
  PRICE_HIGH_LOW: "price_high_low",
  NEWEST: "newest",
  TOP_RATED: "top_rated",
});

// Mongo sort specs keyed by PRODUCT_SORT value
const PRODUCT_SORT_OPTIONS = Object.freeze({
  [PRODUCT_SORT.PRICE_LOW_HIGH]: { price: 1 },
  [PRODUCT_SORT.PRICE_HIGH_LOW]: { price: -1 },
  [PRODUCT_SORT.NEWEST]: { created_at: -1 },
  [PRODUCT_SORT.TOP_RATED]: { rating: -1, rating_count: -1 },
});

const STOCK_STATUS = Object.freeze({
  IN_STOCK: "in_stock",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
});

// Display-only threshold for the computed stock_status label: >3 => in_stock,
// 1-3 => low_stock, 0 => out_of_stock. Deliberately separate from
// InventorySettings.low_stock_threshold, which only drives restock email alerts.
const STOCK_LOW_THRESHOLD = 3;

module.exports = {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
  PRODUCT_SORT,
  PRODUCT_SORT_OPTIONS,
  STOCK_STATUS,
  STOCK_LOW_THRESHOLD,
};
