// utils/stock.js

const { STOCK_STATUS, STOCK_LOW_THRESHOLD } = require("../constants/product.constants");

// stockCount is null for stock_control:false products (untracked = always in stock)
function getStockStatus(stockCount, stockControl) {
  if (!stockControl || stockCount === null || stockCount === undefined) {
    return STOCK_STATUS.IN_STOCK;
  }
  if (stockCount <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (stockCount <= STOCK_LOW_THRESHOLD) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

module.exports = { getStockStatus };
