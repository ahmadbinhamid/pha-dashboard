// Mirrors server/src/utils/orderTotals.js; keep the two rates in step.
export const GST_RATE_PERCENT = 10;
// AU prices include GST: 10% on ex-GST is 1/11 of the inclusive price.
export const GST_DIVISOR = 1 + 100 / GST_RATE_PERCENT;
export const GST_LABEL = `GST (${GST_RATE_PERCENT}%)`;
