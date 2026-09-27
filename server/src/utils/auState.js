// utils/auState.js

const { AU_STATE_CODES, AU_STATE_BY_NAME } = require("../constants/shipping.constants");

/** "Victoria" or "vic" -> "VIC"; unknown text comes back upper-cased. */
function toAuStateCode(state) {
  const value = String(state ?? "").trim().toUpperCase();
  return AU_STATE_BY_NAME[value] ?? value;
}

function isAuState(state) {
  return AU_STATE_CODES.includes(toAuStateCode(state));
}

module.exports = { toAuStateCode, isAuState };
