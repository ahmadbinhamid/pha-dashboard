// utils/tenantCounterKey.js
//
// Normalizes a tenantId into a stable Counter._id namespace. Without this,
// a genuinely-unset tenant_id read off a Mongoose document (`null`, the
// schema default) and a genuinely-omitted function argument (`undefined`)
// would silently produce two DIFFERENT counter keys for what's meant to be
// the same "no tenant" case — confirmed live: this caused order/invoice/
// refund numbering to drift onto two disjoint sequences and collide with
// pre-existing documents. Always route through this helper rather than
// interpolating tenantId into a template string directly.
function tenantCounterKey(tenantId, name) {
  return `${tenantId ?? "none"}:${name}`;
}

module.exports = { tenantCounterKey };
