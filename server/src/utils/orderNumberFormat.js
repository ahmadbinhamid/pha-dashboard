// utils/orderNumberFormat.js
//
// Order.order_number/invoice_number are stored as just the zero-padded
// sequence ("00001"); the prefix each order displays with is its OWN
// order_number_prefix/invoice_number_prefix field (snapshotted at creation
// time from Tenant.order_number_prefix/invoice_number_prefix — see Order.js
// and Tenant.js) — never looked up live from the tenant's current setting,
// so changing that setting only affects orders created afterward, never
// relabels history. The dashboard (React) formats this itself for anything
// it displays directly; this is for the handful of backend-rendered outputs
// the frontend never touches — the PDF invoice and transactional emails.
function formatOrderNumber(prefix, raw) {
  return `${prefix}-${raw}`;
}

function formatInvoiceNumber(prefix, raw) {
  return `${prefix}-${raw}`;
}

// The inverse case: a staff member copies "ORD-00042" straight out of the
// UI and pastes it into a search box (possibly alongside other words, e.g.
// "ord-00042 jeep"). Since that prefix is never stored on Order itself as
// a standalone searchable string (it's a real field, but old orders can
// carry a DIFFERENT historical prefix than what's configured today), this
// only strips whichever prefixes are passed in — normally the tenant's
// CURRENT order_number_prefix/invoice_number_prefix, which covers the
// overwhelmingly common case (prefix hasn't changed, or the user is
// searching with today's prefix). A search for an OLD prefix that's since
// been changed won't get stripped — a known, minor limitation, not a bug.
// `-(?=\d)` keeps this from also mangling an unrelated word that happens to
// start with one of the given prefixes (e.g. a prefix "INV" would otherwise
// eat the start of "inventory").
function stripOrderNumberPrefix(search, prefixes) {
  const list = (prefixes || []).filter(Boolean).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!list.length) return String(search || "");
  const re = new RegExp(`\\b(${list.join("|")})-(?=\\d)`, "gi");
  return String(search || "").replace(re, "");
}

module.exports = { formatOrderNumber, formatInvoiceNumber, stripOrderNumberPrefix };
