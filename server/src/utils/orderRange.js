// utils/orderRange.js
// Plain-English names for a discount's order-number range.

const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

/** "first order", "2nd order", "orders 2 and later", "orders 3 to 5". */
function orderRangeLabel(min, max) {
  if (min === 1 && max === 1) return "first order";
  if (min && min === max) return `${ordinal(min)} order`;
  if (min && !max) return `${ordinal(min)} order onwards`;
  if (!min && max) return `first ${max} orders`;
  return min && max ? `orders ${min} to ${max}` : "any order";
}

module.exports = { orderRangeLabel };
