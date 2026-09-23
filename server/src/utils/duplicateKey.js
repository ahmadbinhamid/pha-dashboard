// utils/duplicateKey.js
// A blanket `err.code === 11000` check throws away which unique index rejected the write;
// Mongo puts that in keyPattern/keyValue, so a duplicate SKU reports as SKU, not slug.

// Every unique index is compound with the tenant scope, so tenant_id never actually collided.
const SCOPE_KEYS = new Set(["tenant_id"]);

function duplicateKeyField(err) {
  if (err?.code !== 11000) return null;
  const fields = Object.keys(err.keyPattern || {}).filter((k) => !SCOPE_KEYS.has(k));
  return fields[0] || null;
}

// Returns null for anything that isn't a duplicate-key error, usable as both test and message.
function duplicateKeyMessage(err, entity, labels = {}) {
  const field = duplicateKeyField(err);
  if (!field) return null;

  const label = labels[field] || field;
  const value = err.keyValue?.[field];
  return value === undefined || value === null
    ? `${entity} ${label} already exists`
    : `${entity} ${label} "${value}" already exists`;
}

module.exports = { duplicateKeyField, duplicateKeyMessage };
