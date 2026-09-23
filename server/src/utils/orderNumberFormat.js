// utils/orderNumberFormat.js
// order_number/invoice_number are stored as just the zero-padded sequence; the prefix comes
// from the order's own snapshotted prefix field, never the tenant's current live setting.
// The dashboard formats this itself; this is for backend-rendered outputs (PDF invoice, emails).
function formatOrderNumber(prefix, raw) {
  return `${prefix}-${raw}`;
}

function formatInvoiceNumber(prefix, raw) {
  return `${prefix}-${raw}`;
}

// The inverse case: a staff member pastes "ORD-00042" into a search box. Only strips whichever
// prefixes are passed in (normally today's current prefix) — a search for an old, since-changed
// prefix won't get stripped, a known minor limitation. `-(?=\d)` avoids mangling a word like
// "inventory" that happens to start with a prefix like "INV".
function stripOrderNumberPrefix(search, prefixes) {
  const list = (prefixes || []).filter(Boolean).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!list.length) return String(search || "");
  const re = new RegExp(`\\b(${list.join("|")})-(?=\\d)`, "gi");
  return String(search || "").replace(re, "");
}

module.exports = { formatOrderNumber, formatInvoiceNumber, stripOrderNumberPrefix };
