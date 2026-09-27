// utils/tenantCounterKey.js
//
// Normalizes tenantId (null vs undefined) to one stable Counter key; avoided a prod numbering-collision bug.
function tenantCounterKey(tenantId, name) {
  return `${tenantId ?? "none"}:${name}`;
}

module.exports = { tenantCounterKey };
