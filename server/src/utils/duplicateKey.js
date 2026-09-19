// utils/duplicateKey.js
//
// A blanket `err.code === 11000` check throws away the one thing the error
// actually tells you: which unique index rejected the write. Mongo puts it
// in `keyPattern`/`keyValue`, so a duplicate SKU can be reported as a SKU
// conflict instead of being mislabelled as a slug conflict.

// Every unique index in this schema is compound with the tenant scope, so
// tenant_id is never the field that collided — it just narrows the index.
const SCOPE_KEYS = new Set(["tenant_id"]);

function duplicateKeyField(err) {
  if (err?.code !== 11000) return null;
  const fields = Object.keys(err.keyPattern || {}).filter((k) => !SCOPE_KEYS.has(k));
  return fields[0] || null;
}

// Returns null for anything that isn't a duplicate-key error, so callers can
// use it as both the test and the message in one step.
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
